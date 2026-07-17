import {
  calculateSprintMetrics,
  evaluateSprintIssue,
  planManagedLabelActions,
} from "@/domain/sprint-intelligence";
import type {
  AnalyzeSprintMilestoneInput,
  ApplySprintMilestoneInput,
  SprintMilestoneAnalysisFailure,
  SprintMilestoneAnalysisResult,
  SprintMilestoneApplyResult,
  SprintMilestoneLabelPlanEntry,
} from "@/domain/types/sprint-intelligence-gitlab";
import type { SprintIssueEvaluation } from "@/domain/types/sprint-intelligence";
import { mapPool } from "@/lib/map-pool";
import { logger } from "@/lib/logger";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";
import { GitLabApiError } from "@/server/providers/gitlab/gitlab-request";

import {
  mapGitLabIssueToSprintInput,
  mapProviderEventsToDomain,
} from "./sprint-intelligence-gitlab.mapper";
import { issueBelongsToTargetMilestone } from "./sprint-intelligence-milestone-match";
import { managedLabelsToEnsureInputs } from "./sprint-intelligence-managed-labels";

const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_MAX_ANALYSIS_AGE_MINUTES = 15;

export class SprintIntelligenceGitLabService {
  constructor(private readonly gitlab: GitLabProvider) {}

  /**
   * Dry-run analysis only. Performs no GitLab writes (including label creation).
   */
  async analyzeMilestone(
    input: AnalyzeSprintMilestoneInput,
  ): Promise<SprintMilestoneAnalysisResult> {
    const startedAt = new Date();
    const maxConcurrency = input.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    const failures: SprintMilestoneAnalysisFailure[] = [];
    const evaluations: SprintIssueEvaluation[] = [];
    const missingLabelsByProject: Record<string, string[]> = {};
    let issuesRetrieved = 0;
    let projectsProcessed = 0;
    let skipped = 0;

    logger.info("sprint-intelligence.gitlab.analysis.started", {
      milestoneId: input.milestone.id,
      milestoneTitle: input.milestone.title,
      projectCount: input.projectIds.length,
      mode: "dry-run",
    });

    for (const projectId of input.projectIds) {
      try {
        // List Issues API: filter by milestone *title* only.
        // `milestone_id` on list endpoints accepts only Any/None/Upcoming/Started,
        // not a numeric ID, and is mutually exclusive with `milestone`.
        const projectIssues = await this.gitlab.listProjectIssues(
          projectId,
          "all",
          {
            milestone: input.milestone.title,
            maxPages: input.maxPages,
          },
        );

        const scoped = projectIssues.filter((issue) =>
          issueBelongsToTargetMilestone(
            issue,
            input.milestone,
            input.allowTitleOnlyMilestoneMatch ?? false,
          ),
        );

        issuesRetrieved += scoped.length;
        projectsProcessed += 1;

        logger.info("sprint-intelligence.gitlab.issues.retrieved", {
          projectId,
          count: scoped.length,
        });

        const projectResults = await mapPool(
          scoped,
          maxConcurrency,
          async (issue) => {
            try {
              const providerEvents =
                await this.gitlab.listIssueResourceMilestoneEvents(
                  projectId,
                  issue.iid,
                  { maxPages: input.maxPages },
                );

              logger.info("sprint-intelligence.gitlab.events.retrieved", {
                projectId,
                issueIid: issue.iid,
                eventCount: providerEvents.length,
              });

              const { domainEvents, ambiguous } = mapProviderEventsToDomain({
                events: providerEvents,
                milestone: input.milestone,
                allowTitleOnlyMilestoneMatch:
                  input.allowTitleOnlyMilestoneMatch,
              });

              if (ambiguous) {
                failures.push({
                  projectId,
                  issueIid: issue.iid,
                  operation: "milestone_match",
                  code: "AMBIGUOUS_MILESTONE_MATCH",
                  message:
                    "Multiple milestone IDs matched the target via title/date rules",
                });
              }

              const normalized = mapGitLabIssueToSprintInput({
                issue,
                milestone: input.milestone,
                milestoneEvents: domainEvents,
                allowTitleOnlyMilestoneMatch:
                  input.allowTitleOnlyMilestoneMatch,
              });

              const evaluation = evaluateSprintIssue(
                normalized,
                input.milestone,
                input.ruleConfig,
              );

              logger.info("sprint-intelligence.gitlab.issue.classified", {
                projectId,
                issueIid: issue.iid,
                planningStatus: evaluation.planningStatus,
                deliveryStatus: evaluation.deliveryStatus,
              });

              return { evaluation };
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Event fetch failed";
              logger.warn("sprint-intelligence.gitlab.issue.failed", {
                projectId,
                issueIid: issue.iid,
                operation: "listIssueResourceMilestoneEvents",
                message,
              });
              failures.push({
                projectId,
                issueIid: issue.iid,
                operation: "listIssueResourceMilestoneEvents",
                code: "MILESTONE_EVENT_FETCH_FAILED",
                message,
              });

              const normalized = mapGitLabIssueToSprintInput({
                issue,
                milestone: input.milestone,
                milestoneEvents: null,
                allowTitleOnlyMilestoneMatch:
                  input.allowTitleOnlyMilestoneMatch,
              });
              const evaluation = evaluateSprintIssue(
                normalized,
                input.milestone,
                input.ruleConfig,
              );
              return { evaluation };
            }
          },
        );

        for (const item of projectResults) {
          evaluations.push(item.evaluation);
        }

        try {
          const labels = await this.gitlab.listProjectLabels(projectId, {
            maxPages: input.maxPages,
          });
          const existing = new Set(labels.map((label) => label.name));
          const required = managedLabelsToEnsureInputs(
            input.ruleConfig.managedLabels,
          );
          const missing = required
            .map((label) => label.name)
            .filter((name) => !existing.has(name));
          if (missing.length > 0) {
            missingLabelsByProject[String(projectId)] = missing;
            logger.info("sprint-intelligence.gitlab.labels.missing", {
              projectId,
              missing,
            });
          }
        } catch (error) {
          failures.push({
            projectId,
            operation: "listProjectLabels",
            code: "LABEL_LIST_FAILED",
            message:
              error instanceof Error ? error.message : "Label list failed",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Project access failed";
        logger.warn("sprint-intelligence.gitlab.issue.failed", {
          projectId,
          operation: "listProjectIssues",
          message,
        });
        failures.push({
          projectId,
          operation: "listProjectIssues",
          code:
            error instanceof GitLabApiError && error.status === 404
              ? "TARGET_MILESTONE_NOT_FOUND"
              : "PROJECT_ACCESS_FAILED",
          message,
        });
        skipped += 1;
      }
    }

    const metrics = calculateSprintMetrics(evaluations);
    const labelPlans: SprintMilestoneLabelPlanEntry[] = evaluations.map(
      (evaluation) => ({
        projectId: evaluation.projectId,
        issueIid: evaluation.issueIid,
        labelsToAdd: evaluation.labelsToAdd,
        labelsToRemove: evaluation.managedLabelsToRemove,
      }),
    );

    const completedAt = new Date();
    const result: SprintMilestoneAnalysisResult = {
      milestone: input.milestone,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      mode: "dry-run",
      managedLabels: { ...input.ruleConfig.managedLabels },
      metrics,
      evaluations,
      labelPlans,
      missingLabelsByProject,
      failures,
      summary: {
        projectsProcessed,
        issuesRetrieved,
        issuesEvaluated: evaluations.length,
        unableToDetermine: evaluations.filter(
          (item) => item.planningStatus === "UnableToDetermine",
        ).length,
        skipped,
        failed: failures.length,
      },
    };

    logger.info("sprint-intelligence.gitlab.analysis.completed", {
      milestoneId: input.milestone.id,
      issuesEvaluated: result.summary.issuesEvaluated,
      failed: result.summary.failed,
      unableToDetermine: result.summary.unableToDetermine,
    });

    return result;
  }

  /**
   * Apply label mutations from a prior dry-run analysis.
   * Requires `confirm: true`. Re-fetches current labels before mutation.
   *
   * Phase 3 limitation: does not fully reclassify milestone assignment /
   * completion state. Prefer re-running analyzeMilestone when the dry-run
   * is older than maxAnalysisAgeMinutes (default 15).
   */
  async applyMilestoneAnalysis(
    input: ApplySprintMilestoneInput,
  ): Promise<SprintMilestoneApplyResult> {
    if (input.confirm !== true) {
      throw new Error("CONFIRMATION_REQUIRED: apply requires confirm: true");
    }
    if (input.analysis.mode !== "dry-run") {
      throw new Error("INVALID_ANALYSIS_MODE: analysis must be a dry-run result");
    }

    const maxAgeMinutes =
      input.maxAnalysisAgeMinutes ?? DEFAULT_MAX_ANALYSIS_AGE_MINUTES;
    const generatedAt = Date.parse(input.analysis.completedAt);
    if (!Number.isFinite(generatedAt)) {
      throw new Error("STALE_ANALYSIS: analysis completedAt is invalid");
    }
    const ageMs = Date.now() - generatedAt;
    if (ageMs > maxAgeMinutes * 60_000) {
      throw new Error(
        `STALE_ANALYSIS: analysis is older than ${maxAgeMinutes} minutes; re-run analyzeMilestone`,
      );
    }

    const startedAt = new Date();
    const createdLabels: Record<string, string[]> = {};
    const applied: SprintMilestoneApplyResult["applied"] = [];
    const skipped: SprintMilestoneApplyResult["skipped"] = [];
    const failed: SprintMilestoneApplyResult["failed"] = [];
    const maxConcurrency = input.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;

    const projectIds = [
      ...new Set(input.analysis.evaluations.map((item) => item.projectId)),
    ];

    if (input.createMissingLabels) {
      for (const projectId of projectIds) {
        try {
          const ensure = await this.gitlab.ensureProjectLabels(
            projectId,
            managedLabelsToEnsureInputs(input.analysis.managedLabels),
            { createMissingLabels: true },
          );
          if (ensure.created.length > 0) {
            createdLabels[String(projectId)] = ensure.created;
          }
          for (const item of ensure.failed) {
            failed.push({
              projectId,
              operation: "ensureProjectLabels",
              message: `${item.label}: ${item.error}`,
            });
          }
        } catch (error) {
          failed.push({
            projectId,
            operation: "ensureProjectLabels",
            message:
              error instanceof Error ? error.message : "Ensure labels failed",
          });
        }
      }
    }

    const plans = input.analysis.labelPlans;
    const planResults = await mapPool(plans, maxConcurrency, async (plan) => {
      const ownershipKey = `${plan.projectId}:${plan.issueIid}`;
      try {
        const current = await this.gitlab.getIssue(
          plan.projectId,
          plan.issueIid,
        );
        const owned =
          input.automationOwnedLabels?.[ownershipKey] ??
          undefined;

        const evaluation = input.analysis.evaluations.find(
          (item) =>
            item.projectId === plan.projectId &&
            item.issueIid === plan.issueIid,
        );

        const refreshed = planManagedLabelActions({
          planningStatus: evaluation?.planningStatus ?? "UnableToDetermine",
          deliveryStatus: evaluation?.deliveryStatus ?? "UnableToDetermine",
          existingLabels: current.labels,
          managedLabels: input.analysis.managedLabels,
          automationOwnedLabels: owned,
        });

        // Only apply labels from the original plan ∩ refreshed plan to avoid
        // surprising removals when ownership is unknown.
        const labelsToAdd = refreshed.labelsToAdd.filter((label) =>
          plan.labelsToAdd.includes(label),
        );
        const labelsToRemove = refreshed.managedLabelsToRemove.filter((label) =>
          plan.labelsToRemove.includes(label),
        );

        if (labelsToAdd.length === 0 && labelsToRemove.length === 0) {
          return {
            kind: "skipped" as const,
            projectId: plan.projectId,
            issueIid: plan.issueIid,
            reason: "no_changes",
          };
        }

        await this.gitlab.updateIssueLabels(plan.projectId, plan.issueIid, {
          labelsToAdd,
          labelsToRemove,
        });

        return {
          kind: "applied" as const,
          projectId: plan.projectId,
          issueIid: plan.issueIid,
          added: labelsToAdd,
          removed: labelsToRemove,
        };
      } catch (error) {
        logger.warn("sprint-intelligence.gitlab.issue.failed", {
          projectId: plan.projectId,
          issueIid: plan.issueIid,
          operation: "updateIssueLabels",
          message: error instanceof Error ? error.message : "update failed",
        });
        return {
          kind: "failed" as const,
          projectId: plan.projectId,
          issueIid: plan.issueIid,
          operation: "updateIssueLabels",
          message: error instanceof Error ? error.message : "update failed",
        };
      }
    });

    for (const item of planResults) {
      if (item.kind === "applied") {
        applied.push({
          projectId: item.projectId,
          issueIid: item.issueIid,
          added: item.added,
          removed: item.removed,
        });
      } else if (item.kind === "skipped") {
        skipped.push({
          projectId: item.projectId,
          issueIid: item.issueIid,
          reason: item.reason,
        });
      } else {
        failed.push({
          projectId: item.projectId,
          issueIid: item.issueIid,
          operation: item.operation,
          message: item.message,
        });
      }
    }

    return {
      mode: "apply",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      createdLabels,
      applied,
      skipped,
      failed,
    };
  }
}

export function createSprintIntelligenceGitLabService(
  gitlab: GitLabProvider,
): SprintIntelligenceGitLabService {
  return new SprintIntelligenceGitLabService(gitlab);
}
