import { randomUUID } from "node:crypto";

import {
  Prisma,
  type SprintEvaluationRun,
  type SprintEvaluationTrigger,
  type SprintLabelAction,
} from "@prisma/client";

import type { SprintIntelligenceRuleConfig } from "@/domain/types/sprint-intelligence";
import type { SprintMilestoneAnalysisResult } from "@/domain/types/sprint-intelligence-gitlab";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getSprintIntelligenceEnvConfig,
  resolveEffectiveSprintIntelligenceConfig,
  SPRINT_INTELLIGENCE_AUTOMATION_VERSION,
  type EffectiveSprintIntelligenceConfig,
} from "@/lib/sprint-intelligence-config";
import { sprintEvaluationRunRepository } from "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository";
import { sprintIssueEvaluationRepository } from "@/server/repositories/sprint-intelligence/sprint-issue-evaluation.repository";
import { sprintLabelActionRepository } from "@/server/repositories/sprint-intelligence/sprint-label-action.repository";
import { sprintManagedLabelOwnershipRepository } from "@/server/repositories/sprint-intelligence/sprint-managed-label-ownership.repository";
import { sprintIntelligenceProjectConfigRepository } from "@/server/repositories/sprint-intelligence/sprint-intelligence-project-config.repository";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { managedLabelsToEnsureInputs } from "@/server/services/sprint/sprint-intelligence-managed-labels";
import { planManagedLabelActions } from "@/domain/sprint-intelligence";
import { mapPool } from "@/lib/map-pool";

import {
  buildAnalyzeRunKey,
  buildApplyRunKey,
  hashSprintAnalysisInput,
  hashSprintAnalysisResult,
  sanitizeErrorMessage,
  withUniqueRunKeySuffix,
} from "./sprint-intelligence-hash";
import { SprintIntelligenceGitLabService } from "./sprint-intelligence-gitlab.service";
import { isSuccessfulAnalysisStatus } from "./sprint-intelligence-run-state";

export type RequestAnalysisInput = {
  projectIds: number[];
  milestone: {
    id: number;
    title: string;
    startDate: string | null;
    dueDate: string | null;
  };
  triggerType?: SprintEvaluationTrigger;
  /** Optional window key for recurring during-sprint analyses. */
  evaluationWindow?: string;
  requestedBy?: string | null;
  correlationId?: string;
};

export type RequestApplyInput = {
  sourceAnalysisRunId: string;
  confirm: true;
  requestedBy?: string | null;
  correlationId?: string;
};

export class SprintIntelligenceExecutionService {
  constructor(
    private readonly gitlabService: SprintIntelligenceGitLabService,
    private readonly gitlab: GitLabProvider,
  ) {}

  async requestAnalysis(input: RequestAnalysisInput): Promise<{
    runId: string;
    status: string;
    reused: boolean;
  }> {
    const env = getSprintIntelligenceEnvConfig();
    if (!env.enabled) {
      throw new Error("FEATURE_DISABLED: Sprint Intelligence is disabled");
    }

    const projectOverride =
      input.projectIds.length === 1
        ? sprintIntelligenceProjectConfigRepository.toOverride(
            await sprintIntelligenceProjectConfigRepository.getByProjectId(
              input.projectIds[0]!,
            ),
          )
        : null;

    const effective = resolveEffectiveSprintIntelligenceConfig(projectOverride);
    const projectIds = [...new Set(input.projectIds)].sort((a, b) => a - b);
    const inputHash = hashSprintAnalysisInput({
      projectIds,
      milestone: input.milestone,
      ruleConfig: effective.ruleConfig,
      allowTitleOnlyMilestoneMatch: effective.allowTitleOnlyMilestoneMatch,
    });
    const triggerType = input.triggerType ?? "MANUAL";
    const baseRunKey = buildAnalyzeRunKey({
      milestoneId: input.milestone.id,
      projectIds,
      inputHash,
      triggerType,
      evaluationWindow: input.evaluationWindow,
    });

    const active =
      await sprintEvaluationRunRepository.findActiveRunByKeyPrefix(baseRunKey);
    if (active) {
      return { runId: active.id, status: active.status, reused: true };
    }

    const existing = await sprintEvaluationRunRepository.getByRunKey(baseRunKey);

    // Scheduled/idempotent callers reuse a successful analysis for the same key.
    // Manual requests always create a fresh run so operators can re-analyze after fixes.
    if (
      existing &&
      isSuccessfulAnalysisStatus(existing.status) &&
      triggerType !== "MANUAL"
    ) {
      return { runId: existing.id, status: existing.status, reused: true };
    }

    // Terminal FAILED/REJECTED/CANCELLED/STALE (or manual re-run after success)
    // still occupy the deterministic key — allocate a unique attempt key.
    const runKey =
      existing != null ? withUniqueRunKeySuffix(baseRunKey) : baseRunKey;

    const correlationId = input.correlationId ?? randomUUID();
    try {
      const run = await sprintEvaluationRunRepository.createPendingRun({
        runKey,
        correlationId,
        mode: "ANALYZE",
        triggerType,
        projectIds,
        milestoneId: input.milestone.id,
        milestoneTitle: input.milestone.title,
        milestoneStartDate: input.milestone.startDate,
        milestoneDueDate: input.milestone.dueDate,
        timezone: effective.ruleConfig.timezone,
        ruleConfigSnapshot: effective.ruleConfig as object,
        inputHash,
        dryRun: true,
        requestedBy: input.requestedBy ?? null,
        automationVersion: SPRINT_INTELLIGENCE_AUTOMATION_VERSION,
      });

      logger.info("sprint-intelligence.run.created", {
        runId: run.id,
        correlationId,
        mode: "ANALYZE",
        milestoneId: run.milestoneId,
        runKey: run.runKey,
      });

      return { runId: run.id, status: run.status, reused: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced =
          (await sprintEvaluationRunRepository.findActiveRunByKeyPrefix(
            baseRunKey,
          )) ?? (await sprintEvaluationRunRepository.getByRunKey(baseRunKey));
        if (raced) {
          return { runId: raced.id, status: raced.status, reused: true };
        }
      }
      throw error;
    }
  }

  async executeAnalysisRun(runId: string): Promise<SprintEvaluationRun> {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) throw new Error(`RUN_NOT_FOUND: ${runId}`);
    if (run.mode !== "ANALYZE") {
      throw new Error("INVALID_MODE: expected ANALYZE run");
    }

    if (run.status === "COMPLETED" || run.status === "PARTIAL") {
      return run;
    }

    await sprintEvaluationRunRepository.markRunning(runId);
    logger.info("sprint-intelligence.run.started", {
      runId,
      correlationId: run.correlationId,
      mode: "ANALYZE",
    });

    const ruleConfig =
      run.ruleConfigSnapshot as unknown as SprintIntelligenceRuleConfig;
    const effective = resolveEffectiveSprintIntelligenceConfig(null);

    try {
      const analysis = await this.gitlabService.analyzeMilestone({
        projectIds: run.projectIds,
        milestone: {
          id: run.milestoneId,
          title: run.milestoneTitle,
          startDate: run.milestoneStartDate,
          dueDate: run.milestoneDueDate,
        },
        ruleConfig,
        createMissingLabels: false,
        maxConcurrency: effective.maxConcurrency,
        maxPages: effective.maxPages,
        allowTitleOnlyMilestoneMatch: effective.allowTitleOnlyMilestoneMatch,
      });

      const analysisHash = hashSprintAnalysisResult(analysis);

      const evaluations =
        await sprintIssueEvaluationRepository.createManyForRun(
          analysis.evaluations.map((evaluation) => ({
            runId,
            projectId: evaluation.projectId,
            issueId: evaluation.issueId,
            issueIid: evaluation.issueIid,
            issueTitle: evaluation.title,
            milestoneId: evaluation.milestoneId,
            milestoneTitle: evaluation.milestoneTitle,
            assignmentTimestamp: evaluation.assignmentTimestamp,
            removalTimestamp: evaluation.milestoneRemovalTimestamp,
            completionTimestamp: evaluation.closedAt,
            planningStatus: evaluation.planningStatus,
            deliveryStatus: evaluation.deliveryStatus,
            workTypes: evaluation.workTypes,
            excludedFromCommitment: evaluation.excludedFromCommitment,
            completedWithinSprint: evaluation.completedWithinSprint,
            existingLabels: evaluation.existingLabels,
            recommendedLabelsToAdd: evaluation.labelsToAdd,
            recommendedManagedLabelsToRemove: evaluation.managedLabelsToRemove,
            reasonCodes: evaluation.reasonCodes,
            eventResolutionDetails: {
              reasonCodes: evaluation.reasonCodes,
            },
            evaluationErrorCode: evaluation.reasonCodes.includes(
              "MILESTONE_HISTORY_UNAVAILABLE",
            )
              ? "MILESTONE_HISTORY_UNAVAILABLE"
              : null,
            evaluationErrorMessage: null,
          })),
        );

      const evaluationByKey = new Map(
        evaluations.map((item) => [
          `${item.projectId}:${item.issueIid}`,
          item.id,
        ]),
      );

      const plannedActions = analysis.labelPlans.flatMap((plan) => {
        const evaluationId =
          evaluationByKey.get(`${plan.projectId}:${plan.issueIid}`) ?? null;
        return [
          ...plan.labelsToAdd.map((label) => ({
            runId,
            issueEvaluationId: evaluationId,
            projectId: Number(plan.projectId),
            issueIid: plan.issueIid,
            label,
            action: "ADD" as const,
          })),
          ...plan.labelsToRemove.map((label) => ({
            runId,
            issueEvaluationId: evaluationId,
            projectId: Number(plan.projectId),
            issueIid: plan.issueIid,
            label,
            action: "REMOVE" as const,
          })),
        ];
      });

      await sprintLabelActionRepository.createPlannedActions(plannedActions);

      const status =
        analysis.summary.failed > 0 && analysis.summary.issuesEvaluated > 0
          ? "PARTIAL"
          : analysis.summary.issuesEvaluated === 0 &&
              analysis.summary.failed > 0
            ? "FAILED"
            : "COMPLETED";

      const completed = await sprintEvaluationRunRepository.completeRun(runId, {
        status,
        summary: analysis.summary as object,
        metrics: analysis.metrics as object,
        analysisHash,
        inputHash: run.inputHash,
        errorCode: status === "FAILED" ? "ANALYSIS_FAILED" : null,
        errorMessage:
          status === "FAILED"
            ? sanitizeErrorMessage(
                analysis.failures.map((f) => f.message).join("; "),
              )
            : null,
      });

      logger.info(
        status === "PARTIAL"
          ? "sprint-intelligence.run.partial"
          : status === "FAILED"
            ? "sprint-intelligence.run.failed"
            : "sprint-intelligence.run.completed",
        {
          runId,
          correlationId: run.correlationId,
          status,
        },
      );
      logger.info("sprint-intelligence.analysis.persisted", {
        runId,
        issuesEvaluated: analysis.summary.issuesEvaluated,
      });

      return completed;
    } catch (error) {
      const message = sanitizeErrorMessage(
        error instanceof Error ? error.message : "Analysis failed",
      );
      await sprintEvaluationRunRepository.completeRun(runId, {
        status: "FAILED",
        errorCode: "ANALYSIS_FAILED",
        errorMessage: message,
      });
      logger.error("sprint-intelligence.run.failed", {
        runId,
        correlationId: run.correlationId,
        error: message,
      });
      throw error;
    }
  }

  async requestApply(input: RequestApplyInput): Promise<{
    runId: string;
    status: string;
    reused: boolean;
  }> {
    if (input.confirm !== true) {
      throw new Error("CONFIRMATION_REQUIRED: apply requires confirm: true");
    }

    const env = getSprintIntelligenceEnvConfig();
    if (!env.enabled) {
      throw new Error("FEATURE_DISABLED: Sprint Intelligence is disabled");
    }
    if (env.dryRunOnly) {
      throw new Error("DRY_RUN_ONLY: apply is disabled while dryRunOnly=true");
    }

    const source = await sprintEvaluationRunRepository.getSourceAnalysisForApply(
      input.sourceAnalysisRunId,
    );
    if (!source) {
      throw new Error(
        "SOURCE_ANALYSIS_INVALID: source analysis run not found or not successful",
      );
    }
    if (!source.analysisHash) {
      throw new Error("SOURCE_ANALYSIS_INVALID: missing analysisHash");
    }

    const ageMinutes =
      (Date.now() - (source.completedAt?.getTime() ?? source.createdAt.getTime())) /
      60_000;
    const maxAge = env.maxAnalysisAgeMinutes;
    if (ageMinutes > maxAge) {
      logger.warn("sprint-intelligence.apply.stale", {
        sourceAnalysisRunId: source.id,
        ageMinutes,
        maxAge,
      });
      throw new Error(
        `STALE_ANALYSIS: analysis is older than ${maxAge} minutes; re-run analyze`,
      );
    }

    const existingApply =
      await sprintEvaluationRunRepository.findSuccessfulApplyForSource(
        source.id,
      );
    if (existingApply) {
      throw new Error(
        "ANALYSIS_ALREADY_CONSUMED: a successful apply already exists for this analysis",
      );
    }

    const baseRunKey = buildApplyRunKey({
      sourceAnalysisRunId: source.id,
      analysisHash: source.analysisHash,
    });

    const active =
      await sprintEvaluationRunRepository.findActiveRunByKeyPrefix(baseRunKey);
    if (active) {
      return { runId: active.id, status: active.status, reused: true };
    }

    const existingApplyForKey =
      await sprintEvaluationRunRepository.getByRunKey(baseRunKey);
    if (
      existingApplyForKey &&
      isSuccessfulAnalysisStatus(existingApplyForKey.status)
    ) {
      return {
        runId: existingApplyForKey.id,
        status: existingApplyForKey.status,
        reused: true,
      };
    }

    const runKey =
      existingApplyForKey != null
        ? withUniqueRunKeySuffix(baseRunKey)
        : baseRunKey;

    const correlationId = input.correlationId ?? randomUUID();
    try {
      const run = await sprintEvaluationRunRepository.createPendingRun({
        runKey,
        correlationId,
        mode: "APPLY",
        triggerType: "MANUAL",
        projectIds: source.projectIds,
        milestoneId: source.milestoneId,
        milestoneTitle: source.milestoneTitle,
        milestoneStartDate: source.milestoneStartDate,
        milestoneDueDate: source.milestoneDueDate,
        timezone: source.timezone,
        ruleConfigSnapshot: source.ruleConfigSnapshot as object,
        inputHash: source.inputHash,
        dryRun: false,
        confirmationRequired: true,
        sourceAnalysisRunId: source.id,
        requestedBy: input.requestedBy ?? null,
        automationVersion: SPRINT_INTELLIGENCE_AUTOMATION_VERSION,
      });

      // Store expected analysis hash on the apply run via complete fields later;
      // also mirror on create by updating analysisHash placeholder.
      await db.sprintEvaluationRun.update({
        where: { id: run.id },
        data: { analysisHash: source.analysisHash },
      });

      logger.info("sprint-intelligence.run.created", {
        runId: run.id,
        correlationId,
        mode: "APPLY",
        sourceAnalysisRunId: source.id,
        runKey: run.runKey,
      });
      logger.info("sprint-intelligence.apply.validated", {
        runId: run.id,
        sourceAnalysisRunId: source.id,
      });

      return { runId: run.id, status: run.status, reused: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced =
          (await sprintEvaluationRunRepository.findActiveRunByKeyPrefix(
            baseRunKey,
          )) ?? (await sprintEvaluationRunRepository.getByRunKey(baseRunKey));
        if (raced) {
          return { runId: raced.id, status: raced.status, reused: true };
        }
      }
      throw error;
    }
  }

  async executeApplyRun(runId: string): Promise<SprintEvaluationRun> {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) throw new Error(`RUN_NOT_FOUND: ${runId}`);
    if (run.mode !== "APPLY") {
      throw new Error("INVALID_MODE: expected APPLY run");
    }
    if (run.status === "COMPLETED" || run.status === "PARTIAL") {
      return run;
    }

    const sourceId = run.sourceAnalysisRunId;
    if (!sourceId) {
      return sprintEvaluationRunRepository.rejectRun(
        runId,
        "SOURCE_ANALYSIS_INVALID",
        "Missing sourceAnalysisRunId",
      );
    }

    const source =
      await sprintEvaluationRunRepository.getSourceAnalysisForApply(sourceId);
    if (!source?.analysisHash) {
      return sprintEvaluationRunRepository.rejectRun(
        runId,
        "SOURCE_ANALYSIS_INVALID",
        "Source analysis unavailable",
      );
    }

    // Rebuild hash from persisted evaluations/actions for integrity.
    const evaluations = await sprintIssueEvaluationRepository.listByRun(
      source.id,
    );
    const plannedActions = await sprintLabelActionRepository.listByRun(
      source.id,
    );
    const rebuilt = rebuildAnalysisResultFromPersistence(
      source,
      evaluations,
    );
    const recalculatedHash = hashSprintAnalysisResult(rebuilt);
    if (recalculatedHash !== source.analysisHash) {
      logger.warn("sprint-intelligence.apply.hash-mismatch", {
        runId,
        sourceAnalysisRunId: source.id,
      });
      return sprintEvaluationRunRepository.rejectRun(
        runId,
        "HASH_MISMATCH",
        "Persisted analysis hash does not match recomputed hash",
      );
    }

    const already =
      await sprintEvaluationRunRepository.findSuccessfulApplyForSource(
        source.id,
      );
    if (already && already.id !== runId) {
      return sprintEvaluationRunRepository.rejectRun(
        runId,
        "ANALYSIS_ALREADY_CONSUMED",
        "Source analysis already applied",
      );
    }

    await sprintEvaluationRunRepository.markRunning(runId);
    logger.info("sprint-intelligence.run.started", {
      runId,
      correlationId: run.correlationId,
      mode: "APPLY",
    });

    const effective = resolveEffectiveSprintIntelligenceConfig(null);
    const managedLabels = (
      source.ruleConfigSnapshot as unknown as SprintIntelligenceRuleConfig
    ).managedLabels;

    // Copy planned actions onto the apply run for audit.
    const applyPlanned = await sprintLabelActionRepository.createPlannedActions(
      plannedActions.map((action) => ({
        runId,
        projectId: action.projectId,
        issueIid: action.issueIid,
        label: action.label,
        action: action.action,
        ownedBefore: action.ownedBefore,
      })),
    );

    if (effective.createMissingLabels) {
      for (const projectId of run.projectIds) {
        await this.gitlab.ensureProjectLabels(
          projectId,
          managedLabelsToEnsureInputs(managedLabels),
          { createMissingLabels: true },
        );
      }
    }

    const ownership = await sprintManagedLabelOwnershipRepository.listActiveForIssues(
      evaluations.map((item) => ({
        projectId: item.projectId,
        issueIid: item.issueIid,
      })),
    );
    const ownedKeys = new Set(
      ownership.map(
        (item) => `${item.projectId}:${item.issueIid}:${item.label}`,
      ),
    );

    let appliedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const byIssue = groupActionsByIssue(applyPlanned);

    await mapPool([...byIssue.entries()], effective.maxConcurrency, async ([key, actions]) => {
      const [projectIdRaw, issueIidRaw] = key.split(":");
      const projectId = Number(projectIdRaw);
      const issueIid = Number(issueIidRaw);

      try {
        const current = await this.gitlab.getIssue(projectId, issueIid);
        const evaluation = evaluations.find(
          (item) => item.projectId === projectId && item.issueIid === issueIid,
        );

        const labelsToAdd = actions
          .filter((action) => action.action === "ADD")
          .map((action) => action.label)
          .filter((label) => !current.labels.includes(label));

        const labelsToRemove = actions
          .filter((action) => action.action === "REMOVE")
          .map((action) => action.label)
          .filter(
            (label) =>
              current.labels.includes(label) &&
              ownedKeys.has(`${projectId}:${issueIid}:${label}`),
          );

        // Recalculate against evaluation statuses for safety.
        const refreshed = planManagedLabelActions({
          planningStatus: (evaluation?.planningStatus ??
            "UnableToDetermine") as never,
          deliveryStatus: (evaluation?.deliveryStatus ??
            "UnableToDetermine") as never,
          existingLabels: current.labels,
          managedLabels,
          automationOwnedLabels: ownership
            .filter(
              (item) =>
                item.projectId === projectId && item.issueIid === issueIid,
            )
            .map((item) => item.label),
        });

        const finalAdd = labelsToAdd.filter((label) =>
          refreshed.labelsToAdd.includes(label),
        );
        const finalRemove = labelsToRemove.filter((label) =>
          refreshed.managedLabelsToRemove.includes(label),
        );

        if (finalAdd.length === 0 && finalRemove.length === 0) {
          for (const action of actions) {
            await sprintLabelActionRepository.recordNoOp(action.id);
            skippedCount += 1;
          }
          return;
        }

        await this.gitlab.updateIssueLabels(projectId, issueIid, {
          labelsToAdd: finalAdd,
          labelsToRemove: finalRemove,
        });

        const after = await this.gitlab.getIssue(projectId, issueIid);

        for (const action of actions) {
          if (
            action.action === "ADD" &&
            finalAdd.includes(action.label) &&
            after.labels.includes(action.label)
          ) {
            await sprintLabelActionRepository.recordApplied(action.id, true);
            await sprintManagedLabelOwnershipRepository.acquireOwnership({
              projectId,
              issueIid,
              milestoneId: run.milestoneId,
              label: action.label,
              sourceRunId: runId,
              sourceLabelActionId: action.id,
              ruleId: action.label,
            });
            logger.info("sprint-intelligence.label.ownership-acquired", {
              runId,
              projectId,
              issueIid,
              label: action.label,
            });
            appliedCount += 1;
          } else if (
            action.action === "REMOVE" &&
            finalRemove.includes(action.label) &&
            !after.labels.includes(action.label)
          ) {
            await sprintLabelActionRepository.recordApplied(action.id, false);
            const active =
              await sprintManagedLabelOwnershipRepository.getActiveOwnership(
                projectId,
                issueIid,
                action.label,
              );
            if (active) {
              await sprintManagedLabelOwnershipRepository.releaseOwnership(
                active.id,
              );
              logger.info("sprint-intelligence.label.ownership-released", {
                runId,
                projectId,
                issueIid,
                label: action.label,
              });
            }
            appliedCount += 1;
          } else {
            await sprintLabelActionRepository.recordSkipped(
              action.id,
              "not_applicable_after_refresh",
            );
            skippedCount += 1;
          }
        }
      } catch (error) {
        failedCount += 1;
        const message = sanitizeErrorMessage(
          error instanceof Error ? error.message : "Apply failed",
        );
        for (const action of actions) {
          await sprintLabelActionRepository.recordFailed(
            action.id,
            "APPLY_FAILED",
            message ?? "APPLY_FAILED",
          );
        }
        logger.warn("sprint-intelligence.worker.job-failed", {
          runId,
          projectId,
          issueIid,
          error: message,
        });
      }
    });

    const status =
      failedCount > 0 && appliedCount > 0
        ? "PARTIAL"
        : failedCount > 0 && appliedCount === 0
          ? "FAILED"
          : "COMPLETED";

    const completed = await sprintEvaluationRunRepository.completeRun(runId, {
      status,
      summary: {
        appliedCount,
        failedCount,
        skippedCount,
      },
      metrics: source.metrics as object,
      analysisHash: source.analysisHash,
      errorCode: status === "FAILED" ? "APPLY_FAILED" : null,
      errorMessage:
        status === "FAILED" ? "All label mutations failed" : null,
    });

    logger.info(
      status === "PARTIAL"
        ? "sprint-intelligence.run.partial"
        : status === "FAILED"
          ? "sprint-intelligence.run.failed"
          : "sprint-intelligence.run.completed",
      { runId, correlationId: run.correlationId, status },
    );

    return completed;
  }

  async getRunStatus(runId: string) {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) return null;
    const evaluations =
      run.mode === "ANALYZE"
        ? await sprintIssueEvaluationRepository.listByRun(runId)
        : [];
    const actions = await sprintLabelActionRepository.listByRun(runId);
    return { run, evaluations, actions };
  }
}

function groupActionsByIssue(
  actions: SprintLabelAction[],
): Map<string, SprintLabelAction[]> {
  const map = new Map<string, SprintLabelAction[]>();
  for (const action of actions) {
    const key = `${action.projectId}:${action.issueIid}`;
    const list = map.get(key) ?? [];
    list.push(action);
    map.set(key, list);
  }
  return map;
}

function rebuildAnalysisResultFromPersistence(
  source: SprintEvaluationRun,
  evaluations: Awaited<
    ReturnType<typeof sprintIssueEvaluationRepository.listByRun>
  >,
): Pick<
  SprintMilestoneAnalysisResult,
  "milestone" | "managedLabels" | "metrics" | "evaluations" | "labelPlans" | "summary"
> {
  const ruleConfig =
    source.ruleConfigSnapshot as unknown as SprintIntelligenceRuleConfig;

  // Must match analyzeMilestone: one label plan per evaluation (including empty
  // add/remove lists). Rebuilding from actions alone drops empty plans and
  // causes HASH_MISMATCH on apply.
  const labelPlans = evaluations.map((evaluation) => ({
    projectId: evaluation.projectId,
    issueIid: evaluation.issueIid,
    labelsToAdd: evaluation.recommendedLabelsToAdd,
    labelsToRemove: evaluation.recommendedManagedLabelsToRemove,
  }));

  return {
    milestone: {
      id: source.milestoneId,
      title: source.milestoneTitle,
      startDate: source.milestoneStartDate,
      dueDate: source.milestoneDueDate,
    },
    managedLabels: ruleConfig.managedLabels,
    metrics: source.metrics as unknown as SprintMilestoneAnalysisResult["metrics"],
    summary:
      source.summary as unknown as SprintMilestoneAnalysisResult["summary"],
    labelPlans,
    evaluations: evaluations.map((evaluation) => ({
      projectId: evaluation.projectId,
      issueId: evaluation.issueId,
      issueIid: evaluation.issueIid,
      title: evaluation.issueTitle,
      state: "",
      milestoneId: evaluation.milestoneId,
      milestoneTitle: evaluation.milestoneTitle,
      assignmentTimestamp: evaluation.assignmentTimestamp,
      milestoneRemovalTimestamp: evaluation.removalTimestamp,
      assignmentUserId: null,
      assignmentUserName: null,
      sprintStart: null,
      sprintEnd: null,
      planningStatus: evaluation.planningStatus as never,
      deliveryStatus: evaluation.deliveryStatus as never,
      workTypes: evaluation.workTypes as never,
      excludedFromCommitment: evaluation.excludedFromCommitment,
      completedWithinSprint: evaluation.completedWithinSprint,
      existingLabels: evaluation.existingLabels,
      labelsToAdd: evaluation.recommendedLabelsToAdd,
      managedLabelsToRemove: evaluation.recommendedManagedLabelsToRemove,
      reasonCodes: evaluation.reasonCodes as never,
      evaluatedAt: evaluation.createdAt,
      assignees: [],
      closedAt: evaluation.completionTimestamp,
    })),
  };
}

export function createSprintIntelligenceExecutionService(): SprintIntelligenceExecutionService | null {
  const config = getGitLabConfig();
  if (!config) return null;
  const gitlab = createGitLabProvider(config);
  return new SprintIntelligenceExecutionService(
    new SprintIntelligenceGitLabService(gitlab),
    gitlab,
  );
}

export type { EffectiveSprintIntelligenceConfig };
