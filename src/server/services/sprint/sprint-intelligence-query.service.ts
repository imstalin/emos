import type {
  Prisma,
  SprintEvaluationRun,
  SprintEvaluationRunMode,
  SprintEvaluationRunStatus,
  SprintEvaluationTrigger,
  SprintIssueEvaluation,
  SprintLabelAction,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  getSprintIntelligenceEnvConfig,
  resolveEffectiveSprintIntelligenceConfig,
} from "@/lib/sprint-intelligence-config";
import { getGitLabConfig, getMonitoredGitLabProjectIds } from "@/lib/gitlab-config";
import { checkRedisConnection } from "@/lib/redis";
import { presentReasonCodes } from "@/domain/sprint-intelligence/reason-code-catalog";
import { sprintEvaluationRunRepository } from "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository";
import { isSuccessfulAnalysisStatus } from "@/server/services/sprint/sprint-intelligence-run-state";
import { sanitizeErrorMessage } from "@/server/services/sprint/sprint-intelligence-hash";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const ISSUE_SORT_FIELDS = [
  "issueIid",
  "issueTitle",
  "title",
  "planningStatus",
  "deliveryStatus",
  "assignmentTimestamp",
  "milestoneAssignedAt",
  "completionTimestamp",
  "completedAt",
  "projectId",
  "projectName",
  "evaluationStatus",
] as const;

const ISSUE_SORT_FIELD_MAP: Record<string, string> = {
  issueIid: "issueIid",
  issueTitle: "issueTitle",
  title: "issueTitle",
  planningStatus: "planningStatus",
  deliveryStatus: "deliveryStatus",
  assignmentTimestamp: "assignmentTimestamp",
  milestoneAssignedAt: "assignmentTimestamp",
  completionTimestamp: "completionTimestamp",
  completedAt: "completionTimestamp",
  projectId: "projectId",
  projectName: "projectId",
  evaluationStatus: "evaluationErrorCode",
};

type IssueSortField = (typeof ISSUE_SORT_FIELDS)[number];

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function clampPage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function clampPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(pageSize));
}

export class SprintIntelligenceQueryService {
  getStatus() {
    const env = getSprintIntelligenceEnvConfig();
    const effective = resolveEffectiveSprintIntelligenceConfig();
    return {
      enabled: env.enabled,
      dryRunOnly: env.dryRunOnly,
      discoveryEnabled: env.discoveryEnabled,
      autoApply: env.autoApply,
      createMissingLabels: env.createMissingLabels,
      timezone: effective.ruleConfig.timezone,
      allowFirstDayAdditions: effective.ruleConfig.allowFirstDayAdditions,
      maxAnalysisAgeMinutes: env.maxAnalysisAgeMinutes,
      gitlabConfigured: Boolean(getGitLabConfig()),
    };
  }

  async getStatusWithWorker() {
    const base = this.getStatus();
    const redisAvailable = await checkRedisConnection();
    const latest = await db.sprintEvaluationRun.findFirst({
      where: { mode: "ANALYZE", status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, milestoneTitle: true, id: true },
    });
    return {
      ...base,
      worker: {
        redisAvailable,
        note: redisAvailable
          ? "Redis is reachable. Ensure `npm run worker` is running to process jobs."
          : "Redis is unavailable. Queued analyses will not start.",
      },
      lastSuccessfulAnalysisAt: latest?.completedAt?.toISOString() ?? null,
      lastSuccessfulAnalysisRunId: latest?.id ?? null,
      lastSuccessfulAnalysisMilestone: latest?.milestoneTitle ?? null,
    };
  }

  async listMilestones() {
    const sprints = await db.sprint.findMany({
      where: { gitlabMilestoneId: { not: null } },
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
      take: 100,
    });

    const projectIds =
      getMonitoredGitLabProjectIds() ??
      (
        await db.gitLabProject.findMany({
          select: { gitlabId: true },
          take: 200,
        })
      )
        .map((p) => p.gitlabId)
        .filter((id): id is number => Number.isFinite(id));

    const results = [];
    for (const sprint of sprints) {
      if (sprint.gitlabMilestoneId == null) continue;
      const latestAnalysis = await db.sprintEvaluationRun.findFirst({
        where: {
          milestoneId: sprint.gitlabMilestoneId,
          mode: "ANALYZE",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          completedAt: true,
          triggerType: true,
          createdAt: true,
        },
      });
      const activeRun = await db.sprintEvaluationRun.findFirst({
        where: {
          milestoneId: sprint.gitlabMilestoneId,
          mode: "ANALYZE",
          status: { in: ["PENDING", "QUEUED", "RUNNING"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      });

      results.push({
        milestoneId: sprint.gitlabMilestoneId,
        title: sprint.name,
        startDate: sprint.startDate.toISOString().slice(0, 10),
        dueDate: sprint.endDate.toISOString().slice(0, 10),
        isActive: sprint.isActive,
        projectIds,
        latestAnalysis,
        activeRun,
      });
    }

    return { milestones: results, defaultProjectIds: projectIds };
  }

  async listRuns(params: {
    page?: number;
    pageSize?: number;
    mode?: SprintEvaluationRunMode;
    status?: SprintEvaluationRunStatus;
    triggerType?: SprintEvaluationTrigger;
    milestoneId?: number;
  }): Promise<PaginatedResult<ReturnType<typeof serializeRun>>> {
    const page = clampPage(params.page ?? 1);
    const pageSize = clampPageSize(params.pageSize ?? DEFAULT_PAGE_SIZE);
    const where: Prisma.SprintEvaluationRunWhereInput = {
      ...(params.mode ? { mode: params.mode } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.triggerType ? { triggerType: params.triggerType } : {}),
      ...(params.milestoneId != null
        ? { milestoneId: params.milestoneId }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.sprintEvaluationRun.count({ where }),
      db.sprintEvaluationRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map(serializeRun),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getRunDetail(runId: string) {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) return null;

    const [evaluationCount, actionCount, failedActions, applyConsumer, unableCount] =
      await Promise.all([
        db.sprintIssueEvaluation.count({ where: { runId } }),
        db.sprintLabelAction.count({ where: { runId } }),
        db.sprintLabelAction.count({
          where: { runId, status: "FAILED" },
        }),
        run.mode === "ANALYZE"
          ? sprintEvaluationRunRepository.findSuccessfulApplyForSource(runId)
          : Promise.resolve(null),
        db.sprintIssueEvaluation.count({
          where: {
            runId,
            OR: [
              { planningStatus: "UnableToDetermine" },
              { deliveryStatus: "UnableToDetermine" },
            ],
          },
        }),
      ]);

    const env = getSprintIntelligenceEnvConfig();
    const ageMinutes = run.completedAt
      ? (Date.now() - run.completedAt.getTime()) / 60_000
      : null;
    const stale =
      run.mode === "ANALYZE" &&
      ageMinutes != null &&
      ageMinutes > env.maxAnalysisAgeMinutes;
    const actionableAdds = await db.sprintLabelAction.count({
      where: { runId, action: "ADD", status: "PLANNED" },
    });
    const actionableRemoves = await db.sprintLabelAction.count({
      where: { runId, action: "REMOVE", status: "PLANNED" },
    });
    const actionableLabelChanges = actionableAdds + actionableRemoves;

    const applyEligible =
      run.mode === "ANALYZE" &&
      env.enabled &&
      !env.dryRunOnly &&
      isSuccessfulAnalysisStatus(run.status) &&
      !stale &&
      !applyConsumer &&
      Boolean(run.analysisHash) &&
      actionableLabelChanges > 0;

    const actionEligibility = {
      applyEligible,
      reasons: [
        !env.enabled ? "FEATURE_DISABLED" : null,
        env.dryRunOnly ? "DRY_RUN_ONLY" : null,
        run.mode !== "ANALYZE" ? "NOT_ANALYSIS_RUN" : null,
        !isSuccessfulAnalysisStatus(run.status) ? "ANALYSIS_NOT_SUCCESSFUL" : null,
        stale ? "STALE_ANALYSIS" : null,
        applyConsumer ? "ALREADY_CONSUMED" : null,
        !run.analysisHash ? "HASH_MISSING" : null,
        actionableLabelChanges === 0 ? "NO_ACTIONABLE_CHANGES" : null,
      ].filter(Boolean) as string[],
      actionableLabelChanges,
      actionableAdds,
      actionableRemoves,
      stale,
      consumedByApplyRunId: applyConsumer?.id ?? null,
      hashPresent: Boolean(run.analysisHash),
    };

    const summary = run.summary as Record<string, unknown>;
    const failureCount =
      failedActions +
      unableCount +
      (typeof summary.failed === "number" ? summary.failed : 0);

    return {
      ...serializeRun(run),
      run: serializeRun(run),
      evaluationCount,
      actionCount,
      failedActionCount: failedActions,
      failureCount,
      unableToDetermineCount: unableCount,
      hashPresent: Boolean(run.analysisHash),
      stale,
      ageMinutes,
      maxAnalysisAgeMinutes: env.maxAnalysisAgeMinutes,
      consumedByApplyRunId: applyConsumer?.id ?? null,
      applyEligible,
      actionableLabelChanges,
      actionEligibility,
      sourceAnalysisRunId: run.sourceAnalysisRunId,
    };
  }

  async getRunSummary(runId: string) {
    const detail = await this.getRunDetail(runId);
    if (!detail) return null;
    return {
      runId: detail.id,
      status: detail.status,
      mode: detail.mode,
      metrics: detail.metrics,
      summary: detail.summary,
      milestoneId: detail.milestoneId,
      milestoneTitle: detail.milestoneTitle,
      completedAt: detail.completedAt,
      failureCount: detail.failureCount,
      actionEligibility: detail.actionEligibility,
    };
  }

  async listIssues(
    runId: string,
    params: {
      page?: number;
      pageSize?: number;
      planningStatus?: string;
      deliveryStatus?: string;
      workType?: string;
      projectId?: number;
      search?: string;
      excludedFromCommitment?: boolean;
      hasRecommendedChanges?: boolean;
      hasError?: boolean;
      hasEvaluationError?: boolean;
      existingLabel?: string;
      state?: "opened" | "closed";
      sortBy?: string;
      sortDir?: "asc" | "desc";
    },
  ): Promise<PaginatedResult<ReturnType<typeof serializeIssueListItem>>> {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    const page = clampPage(params.page ?? 1);
    const pageSize = clampPageSize(params.pageSize ?? DEFAULT_PAGE_SIZE);
    const sortKey = ISSUE_SORT_FIELDS.includes(params.sortBy as IssueSortField)
      ? (params.sortBy as IssueSortField)
      : "issueIid";
    const prismaSortField = ISSUE_SORT_FIELD_MAP[sortKey] ?? "issueIid";
    const sortDir = params.sortDir === "desc" ? "desc" : "asc";
    const hasEvalError = params.hasEvaluationError ?? params.hasError;

    const where: Prisma.SprintIssueEvaluationWhereInput = {
      runId,
      ...(params.planningStatus
        ? { planningStatus: params.planningStatus }
        : {}),
      ...(params.deliveryStatus
        ? { deliveryStatus: params.deliveryStatus }
        : {}),
      ...(params.projectId != null ? { projectId: params.projectId } : {}),
      ...(params.workType ? { workTypes: { has: params.workType } } : {}),
      ...(params.excludedFromCommitment != null
        ? { excludedFromCommitment: params.excludedFromCommitment }
        : {}),
      ...(hasEvalError === true
        ? { evaluationErrorCode: { not: null } }
        : hasEvalError === false
          ? { evaluationErrorCode: null }
          : {}),
      ...(params.existingLabel
        ? { existingLabels: { has: params.existingLabel } }
        : {}),
      ...(params.state === "closed"
        ? { completionTimestamp: { not: null } }
        : params.state === "opened"
          ? { completionTimestamp: null }
          : {}),
      ...(params.hasRecommendedChanges === true
        ? {
            OR: [
              { recommendedLabelsToAdd: { isEmpty: false } },
              { recommendedManagedLabelsToRemove: { isEmpty: false } },
            ],
          }
        : params.hasRecommendedChanges === false
          ? {
              AND: [
                { recommendedLabelsToAdd: { isEmpty: true } },
                { recommendedManagedLabelsToRemove: { isEmpty: true } },
              ],
            }
          : {}),
      ...(params.search?.trim()
        ? {
            OR: [
              Number.isFinite(Number(params.search))
                ? { issueIid: Number(params.search) }
                : undefined,
              {
                issueTitle: {
                  contains: params.search.trim(),
                  mode: "insensitive",
                },
              },
            ].filter(Boolean) as Prisma.SprintIssueEvaluationWhereInput[],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.sprintIssueEvaluation.count({ where }),
      db.sprintIssueEvaluation.findMany({
        where,
        orderBy: { [prismaSortField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          projectId: true,
          issueId: true,
          issueIid: true,
          issueTitle: true,
          planningStatus: true,
          deliveryStatus: true,
          workTypes: true,
          assignmentTimestamp: true,
          completionTimestamp: true,
          existingLabels: true,
          recommendedLabelsToAdd: true,
          recommendedManagedLabelsToRemove: true,
          reasonCodes: true,
          excludedFromCommitment: true,
          completedWithinSprint: true,
          evaluationErrorCode: true,
          evaluationErrorMessage: true,
        },
      }),
    ]);

    const projectWebUrls = await loadProjectWebUrls(
      items.map((item) => item.projectId),
    );

    return {
      items: items.map((item) =>
        serializeIssueListItem(item, projectWebUrls.get(item.projectId)),
      ),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getIssueDetail(runId: string, evaluationId: string) {
    const evaluation = await db.sprintIssueEvaluation.findFirst({
      where: { id: evaluationId, runId },
    });
    if (!evaluation) return null;

    const run = await sprintEvaluationRunRepository.getById(runId);
    const [actions, projectWebUrls] = await Promise.all([
      db.sprintLabelAction.findMany({
        where: {
          runId,
          projectId: evaluation.projectId,
          issueIid: evaluation.issueIid,
        },
        orderBy: { createdAt: "asc" },
      }),
      loadProjectWebUrls([evaluation.projectId]),
    ]);

    return {
      evaluation: serializeIssueDetail(
        evaluation,
        projectWebUrls.get(evaluation.projectId),
      ),
      reasonPresentations: presentReasonCodes(evaluation.reasonCodes),
      labelActions: actions.map(serializeLabelAction),
      sprint: run
        ? {
            milestoneId: run.milestoneId,
            milestoneTitle: run.milestoneTitle,
            startDate: run.milestoneStartDate,
            dueDate: run.milestoneDueDate,
            timezone: run.timezone,
          }
        : null,
    };
  }

  async listLabelActions(
    runId: string,
    params: {
      page?: number;
      pageSize?: number;
      action?: "ADD" | "REMOVE";
      status?: string;
    },
  ): Promise<PaginatedResult<ReturnType<typeof serializeLabelAction>>> {
    const page = clampPage(params.page ?? 1);
    const pageSize = clampPageSize(params.pageSize ?? DEFAULT_PAGE_SIZE);
    const where: Prisma.SprintLabelActionWhereInput = {
      runId,
      ...(params.action ? { action: params.action } : {}),
      ...(params.status
        ? { status: params.status as SprintLabelAction["status"] }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.sprintLabelAction.count({ where }),
      db.sprintLabelAction.findMany({
        where,
        orderBy: [{ projectId: "asc" }, { issueIid: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map(serializeLabelAction),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listFailures(runId: string) {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) return null;

    const [issueFailures, actionFailures] = await Promise.all([
      db.sprintIssueEvaluation.findMany({
        where: {
          runId,
          OR: [
            { evaluationErrorCode: { not: null } },
            { planningStatus: "UnableToDetermine" },
          ],
        },
        select: {
          id: true,
          projectId: true,
          issueIid: true,
          issueTitle: true,
          planningStatus: true,
          deliveryStatus: true,
          evaluationErrorCode: true,
          evaluationErrorMessage: true,
          reasonCodes: true,
          createdAt: true,
        },
        take: 500,
      }),
      db.sprintLabelAction.findMany({
        where: { runId, status: { in: ["FAILED", "REJECTED"] } },
        take: 500,
      }),
    ]);

    const summary = run.summary as Record<string, unknown>;
    return {
      runId,
      runStatus: run.status,
      runErrorCode: run.errorCode,
      runErrorMessage: sanitizeErrorMessage(run.errorMessage),
      summaryFailures: summary.failed ?? null,
      issueFailures: issueFailures.map((item) => ({
        ...item,
        evaluationErrorMessage: sanitizeErrorMessage(
          item.evaluationErrorMessage,
        ),
        reasons: presentReasonCodes(item.reasonCodes),
        createdAt: item.createdAt.toISOString(),
      })),
      actionFailures: actionFailures.map(serializeLabelAction),
    };
  }

  getConfigView() {
    const env = getSprintIntelligenceEnvConfig();
    const effective = resolveEffectiveSprintIntelligenceConfig();
    return {
      values: {
        enabled: { value: env.enabled, source: "environment" },
        dryRunOnly: { value: env.dryRunOnly, source: "environment" },
        discoveryEnabled: {
          value: env.discoveryEnabled,
          source: "environment",
        },
        autoApply: { value: env.autoApply, source: "environment" },
        createMissingLabels: {
          value: env.createMissingLabels,
          source: "environment",
        },
        timezone: {
          value: effective.ruleConfig.timezone,
          source: "environment",
        },
        allowFirstDayAdditions: {
          value: effective.ruleConfig.allowFirstDayAdditions,
          source: "environment",
        },
        supportExcludedFromCommitment: {
          value: effective.ruleConfig.supportExcludedFromCommitment,
          source: "environment",
        },
        hotfixExcludedFromCommitment: {
          value: effective.ruleConfig.hotfixExcludedFromCommitment,
          source: "environment",
        },
        uatExcludedFromCommitment: {
          value: effective.ruleConfig.uatExcludedFromCommitment,
          source: "environment",
        },
        allowTitleOnlyMilestoneMatch: {
          value: effective.allowTitleOnlyMilestoneMatch,
          source: "domain default",
        },
        maxConcurrency: {
          value: effective.maxConcurrency,
          source: "environment",
        },
        maxPages: { value: effective.maxPages ?? null, source: "environment" },
        maxAnalysisAgeMinutes: {
          value: env.maxAnalysisAgeMinutes,
          source: "environment",
        },
        discoveryIntervalMinutes: {
          value: env.discoveryIntervalMinutes,
          source: "environment",
        },
        duringSprintIntervalMinutes: {
          value: env.duringSprintIntervalMinutes,
          source: "environment",
        },
      },
      notes: [
        "Configuration is read-only in this view.",
        "GitLab tokens and Redis credentials are never exposed.",
        "Production deployments should place EMOS behind access control.",
      ],
    };
  }

  /** Alias used by API routes. */
  getEffectiveConfig() {
    return this.getConfigView();
  }

  async exportIssuesCsv(
    runId: string,
    filters: {
      projectId?: number;
      planningStatus?: string;
      deliveryStatus?: string;
      workType?: string;
      search?: string;
    } = {},
  ): Promise<{ csv: string; filename: string }> {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");

    const where: Prisma.SprintIssueEvaluationWhereInput = {
      runId,
      ...(filters.projectId != null ? { projectId: filters.projectId } : {}),
      ...(filters.planningStatus
        ? { planningStatus: filters.planningStatus }
        : {}),
      ...(filters.deliveryStatus
        ? { deliveryStatus: filters.deliveryStatus }
        : {}),
      ...(filters.workType ? { workTypes: { has: filters.workType } } : {}),
      ...(filters.search?.trim()
        ? {
            OR: [
              Number.isFinite(Number(filters.search))
                ? { issueIid: Number(filters.search) }
                : undefined,
              {
                issueTitle: {
                  contains: filters.search.trim(),
                  mode: "insensitive",
                },
              },
            ].filter(Boolean) as Prisma.SprintIssueEvaluationWhereInput[],
          }
        : {}),
    };

    const items = await db.sprintIssueEvaluation.findMany({
      where,
      orderBy: [{ projectId: "asc" }, { issueIid: "asc" }],
      take: 10_000,
    });

    const headers = [
      "Run ID",
      "Milestone",
      "Project",
      "Issue IID",
      "Title",
      "Assignee",
      "Planning Status",
      "Delivery Status",
      "Work Types",
      "Milestone Assigned At",
      "Completed At",
      "Excluded From Commitment",
      "Completed Within Sprint",
      "Existing Labels",
      "Labels To Add",
      "Labels To Remove",
      "Reason Codes",
      "Evaluation Error",
    ];

    const rows = items.map((item) => [
      run.id,
      run.milestoneTitle,
      String(item.projectId),
      String(item.issueIid),
      item.issueTitle,
      "",
      item.planningStatus,
      item.deliveryStatus,
      item.workTypes.join("|"),
      item.assignmentTimestamp?.toISOString() ?? "",
      item.completionTimestamp?.toISOString() ?? "",
      String(item.excludedFromCommitment),
      String(item.completedWithinSprint),
      item.existingLabels.join("|"),
      item.recommendedLabelsToAdd.join("|"),
      item.recommendedManagedLabelsToRemove.join("|"),
      item.reasonCodes.join("|"),
      item.evaluationErrorCode ?? "",
    ]);

    const datePart = (run.completedAt ?? run.requestedAt)
      .toISOString()
      .slice(0, 10);
    const milestoneSlug = slugify(run.milestoneTitle);

    return {
      csv: toCsv([headers, ...rows]),
      filename: `sprint-intelligence-${milestoneSlug}-${datePart}.csv`,
    };
  }

  async exportLabelActionsCsv(
    runId: string,
  ): Promise<{ csv: string; filename: string }> {
    const run = await sprintEvaluationRunRepository.getById(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");

    const items = await db.sprintLabelAction.findMany({
      where: { runId },
      orderBy: [{ projectId: "asc" }, { issueIid: "asc" }],
      take: 10_000,
    });

    const headers = [
      "Run ID",
      "Milestone",
      "Project",
      "Issue IID",
      "Label",
      "Action",
      "Status",
      "Owned Before",
      "Owned After",
      "Planned At",
      "Attempted At",
      "Completed At",
      "Error",
    ];

    const rows = items.map((item) => [
      run.id,
      run.milestoneTitle,
      String(item.projectId),
      String(item.issueIid),
      item.label,
      item.action,
      item.status,
      String(item.ownedBefore),
      item.ownedAfter == null ? "" : String(item.ownedAfter),
      item.plannedAt.toISOString(),
      item.attemptedAt?.toISOString() ?? "",
      item.completedAt?.toISOString() ?? "",
      item.errorCode ?? "",
    ]);

    const datePart = (run.completedAt ?? run.requestedAt)
      .toISOString()
      .slice(0, 10);
    const milestoneSlug = slugify(run.milestoneTitle);

    return {
      csv: toCsv([headers, ...rows]),
      filename: `sprint-label-actions-${milestoneSlug}-${datePart}.csv`,
    };
  }
}

async function loadProjectWebUrls(
  projectIds: number[],
): Promise<Map<number, string>> {
  const unique = [...new Set(projectIds)];
  if (unique.length === 0) return new Map();
  const projects = await db.gitLabProject.findMany({
    where: { gitlabId: { in: unique } },
    select: { gitlabId: true, webUrl: true },
  });
  const map = new Map<number, string>();
  for (const project of projects) {
    if (project.gitlabId != null && project.webUrl) {
      map.set(project.gitlabId, project.webUrl);
    }
  }
  return map;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "milestone"
  );
}

function serializeRun(run: SprintEvaluationRun) {
  return {
    id: run.id,
    runKey: run.runKey,
    correlationId: run.correlationId,
    mode: run.mode,
    status: run.status,
    triggerType: run.triggerType,
    projectIds: run.projectIds,
    milestoneId: run.milestoneId,
    milestoneTitle: run.milestoneTitle,
    milestoneStartDate: run.milestoneStartDate,
    milestoneDueDate: run.milestoneDueDate,
    timezone: run.timezone,
    dryRun: run.dryRun,
    jobId: run.jobId,
    inputHash: run.inputHash,
    analysisHash: run.analysisHash,
    sourceAnalysisRunId: run.sourceAnalysisRunId,
    summary: run.summary,
    metrics: run.metrics,
    errorCode: run.errorCode,
    errorMessage: sanitizeErrorMessage(run.errorMessage),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    requestedAt: run.requestedAt.toISOString(),
    createdAt: run.createdAt.toISOString(),
  };
}

function buildIssueWebUrl(
  projectWebUrl: string | undefined,
  issueIid: number,
): string | null {
  if (!projectWebUrl) return null;
  const base = projectWebUrl.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) return null;
  return `${base}/-/issues/${issueIid}`;
}

function serializeIssueListItem(
  item: Pick<
    SprintIssueEvaluation,
    | "id"
    | "projectId"
    | "issueId"
    | "issueIid"
    | "issueTitle"
    | "planningStatus"
    | "deliveryStatus"
    | "workTypes"
    | "assignmentTimestamp"
    | "completionTimestamp"
    | "existingLabels"
    | "recommendedLabelsToAdd"
    | "recommendedManagedLabelsToRemove"
    | "reasonCodes"
    | "excludedFromCommitment"
    | "completedWithinSprint"
    | "evaluationErrorCode"
    | "evaluationErrorMessage"
  >,
  projectWebUrl?: string,
) {
  return {
    id: item.id,
    projectId: item.projectId,
    issueId: item.issueId,
    issueIid: item.issueIid,
    issueTitle: item.issueTitle,
    assigneeUsername: null as string | null,
    issueWebUrl: buildIssueWebUrl(projectWebUrl, item.issueIid),
    planningStatus: item.planningStatus,
    deliveryStatus: item.deliveryStatus,
    workTypes: item.workTypes,
    assignmentTimestamp: item.assignmentTimestamp?.toISOString() ?? null,
    completionTimestamp: item.completionTimestamp?.toISOString() ?? null,
    existingLabels: item.existingLabels,
    recommendedLabelsToAdd: item.recommendedLabelsToAdd,
    recommendedManagedLabelsToRemove: item.recommendedManagedLabelsToRemove,
    reasonCodes: item.reasonCodes,
    excludedFromCommitment: item.excludedFromCommitment,
    completedWithinSprint: item.completedWithinSprint,
    evaluationErrorCode: item.evaluationErrorCode,
    evaluationErrorMessage: sanitizeErrorMessage(item.evaluationErrorMessage),
    evaluationStatus: item.evaluationErrorCode ? "Error" : "Ok",
  };
}

function serializeIssueDetail(
  item: SprintIssueEvaluation,
  projectWebUrl?: string,
) {
  return {
    ...serializeIssueListItem(item, projectWebUrl),
    removalTimestamp: item.removalTimestamp?.toISOString() ?? null,
    eventResolutionDetails: item.eventResolutionDetails,
    createdAt: item.createdAt.toISOString(),
  };
}

function serializeLabelAction(action: SprintLabelAction) {
  return {
    id: action.id,
    projectId: action.projectId,
    issueIid: action.issueIid,
    label: action.label,
    action: action.action,
    status: action.status,
    ownedBefore: action.ownedBefore,
    ownedAfter: action.ownedAfter,
    plannedAt: action.plannedAt.toISOString(),
    attemptedAt: action.attemptedAt?.toISOString() ?? null,
    completedAt: action.completedAt?.toISOString() ?? null,
    errorCode: action.errorCode,
    errorMessage: sanitizeErrorMessage(action.errorMessage),
  };
}

export function sanitizeCsvCell(value: string): string {
  const needsFormulaGuard = /^[=+\-@]/.test(value);
  const escaped = value.replace(/"/g, '""');
  const guarded = needsFormulaGuard ? `'${escaped}` : escaped;
  return `"${guarded}"`;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => sanitizeCsvCell(String(cell))).join(","))
    .join("\n");
}

export const sprintIntelligenceQueryService =
  new SprintIntelligenceQueryService();
