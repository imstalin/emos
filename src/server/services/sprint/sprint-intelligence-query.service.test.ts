import { afterEach, describe, expect, it, vi } from "vitest";

import { presentReasonCode } from "@/domain/sprint-intelligence/reason-code-catalog";
import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import {
  sanitizeCsvCell,
  SprintIntelligenceQueryService,
} from "@/server/services/sprint/sprint-intelligence-query.service";

vi.mock("@/lib/db", () => {
  const sprintEvaluationRun = {
    findFirst: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const sprintIssueEvaluation = {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  };
  const sprintLabelAction = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const sprint = {
    findMany: vi.fn(),
  };
  const gitLabProject = {
    findMany: vi.fn(),
  };
  return {
    db: {
      sprintEvaluationRun,
      sprintIssueEvaluation,
      sprintLabelAction,
      sprint,
      gitLabProject,
    },
  };
});

vi.mock("@/lib/redis", () => ({
  checkRedisConnection: vi.fn(async () => true),
}));

vi.mock("@/lib/gitlab-config", () => ({
  getGitLabConfig: vi.fn(() => ({
    url: "https://gitlab.example.com",
    token: "token",
    groupId: "1",
    baseUrl: "https://gitlab.example.com/api/v4",
    webhookSecret: null,
    monitoredProjectIds: [10, 20],
  })),
  getMonitoredGitLabProjectIds: vi.fn(() => [10, 20]),
}));

vi.mock(
  "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository",
  () => ({
    sprintEvaluationRunRepository: {
      getById: vi.fn(),
      findSuccessfulApplyForSource: vi.fn(),
    },
  }),
);

import { db } from "@/lib/db";
import { sprintEvaluationRunRepository } from "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository";

describe("sanitizeCsvCell", () => {
  it("guards spreadsheet formula characters", () => {
    expect(sanitizeCsvCell("=1+1")).toBe(`"'=1+1"`);
    expect(sanitizeCsvCell("+cmd")).toBe(`"'+cmd"`);
    expect(sanitizeCsvCell("-2")).toBe(`"'-2"`);
    expect(sanitizeCsvCell("@x")).toBe(`"'@x"`);
  });

  it("escapes quotes", () => {
    expect(sanitizeCsvCell('say "hi"')).toBe(`"say ""hi"""`);
  });
});

describe("reason code presentation", () => {
  it("maps known codes to human-readable explanations", () => {
    const presented = presentReasonCode("ASSIGNED_AFTER_SPRINT_BOUNDARY");
    expect(presented.title).toBe("Added after planning");
    expect(presented.explanation).toContain("after the allowed planning period");
  });

  it("maps ambiguous milestone match with suggested action", () => {
    const presented = presentReasonCode("AMBIGUOUS_MILESTONE_MATCH");
    expect(presented.severity).toBe("warning");
    expect(presented.suggestedAction).toContain("Verify milestone");
  });
});

describe("sprint intelligence API errors", () => {
  it("returns structured RUN_NOT_FOUND", async () => {
    const response = handleRouteError(new Error("RUN_NOT_FOUND"));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("RUN_NOT_FOUND");
    expect(body.error.message).toContain("not found");
  });

  it("returns structured FEATURE_DISABLED", async () => {
    const response = handleRouteError(new Error("FEATURE_DISABLED"));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FEATURE_DISABLED");
  });
});

describe("SprintIntelligenceQueryService", () => {
  const originalEnv = { ...process.env };
  const service = new SprintIntelligenceQueryService();

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("returns disabled feature status by default", async () => {
    delete process.env.SPRINT_INTELLIGENCE_ENABLED;
    delete process.env.SPRINT_INTELLIGENCE_DRY_RUN_ONLY;
    vi.mocked(db.sprintEvaluationRun.findFirst).mockResolvedValue(null);

    const status = await service.getStatusWithWorker();
    expect(status.enabled).toBe(false);
    expect(status.dryRunOnly).toBe(true);
    expect(status.autoApply).toBe(false);
    expect(status.worker.redisAvailable).toBe(true);
  });

  it("omits secrets from config view", () => {
    const config = service.getEffectiveConfig();
    const keys = Object.keys(config.values);
    expect(keys).not.toContain("gitlabToken");
    expect(keys).not.toContain("redisUrl");
    expect(keys).not.toContain("token");
    expect(config.values.enabled).toBeDefined();
    expect(config.values.dryRunOnly).toBeDefined();
    expect(config.notes.some((note) => note.includes("never exposed"))).toBe(
      true,
    );
  });

  it("lists milestones with latest and active runs", async () => {
    vi.mocked(db.sprint.findMany).mockResolvedValue([
      {
        id: "s1",
        name: "Sprint 42",
        gitlabMilestoneId: 42,
        startDate: new Date("2026-07-06"),
        endDate: new Date("2026-07-17"),
        isActive: true,
      },
    ] as never);
    vi.mocked(db.sprintEvaluationRun.findFirst)
      .mockResolvedValueOnce({
        id: "run-1",
        status: "COMPLETED",
        completedAt: new Date("2026-07-16"),
        triggerType: "MANUAL",
        createdAt: new Date("2026-07-16"),
      } as never)
      .mockResolvedValueOnce(null);

    const result = await service.listMilestones();
    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].milestoneId).toBe(42);
    expect(result.milestones[0].latestAnalysis?.id).toBe("run-1");
    expect(result.defaultProjectIds).toEqual([10, 20]);
  });

  it("paginates runs and serializes dates", async () => {
    vi.mocked(db.sprintEvaluationRun.count).mockResolvedValue(1);
    vi.mocked(db.sprintEvaluationRun.findMany).mockResolvedValue([
      {
        id: "run-1",
        runKey: "k",
        correlationId: "c",
        mode: "ANALYZE",
        status: "COMPLETED",
        triggerType: "MANUAL",
        projectIds: [10],
        milestoneId: 42,
        milestoneTitle: "Sprint 42",
        milestoneStartDate: "2026-07-06",
        milestoneDueDate: "2026-07-17",
        timezone: "Asia/Kolkata",
        dryRun: true,
        jobId: null,
        inputHash: null,
        analysisHash: "hash",
        sourceAnalysisRunId: null,
        summary: {},
        metrics: {},
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: new Date("2026-07-16T10:00:00Z"),
        requestedAt: new Date("2026-07-16T09:00:00Z"),
        createdAt: new Date("2026-07-16T09:00:00Z"),
      },
    ] as never);

    const result = await service.listRuns({ page: 1, pageSize: 10, mode: "ANALYZE" });
    expect(result.total).toBe(1);
    expect(result.items[0].completedAt).toBe("2026-07-16T10:00:00.000Z");
  });

  it("returns null for missing run detail", async () => {
    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue(null);
    await expect(service.getRunDetail("missing")).resolves.toBeNull();
  });

  it("computes apply eligibility for completed analysis", async () => {
    process.env.SPRINT_INTELLIGENCE_ENABLED = "true";
    process.env.SPRINT_INTELLIGENCE_DRY_RUN_ONLY = "false";
    process.env.SPRINT_INTELLIGENCE_MAX_ANALYSIS_AGE_MINUTES = "1440";

    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue({
      id: "run-1",
      mode: "ANALYZE",
      status: "COMPLETED",
      completedAt: new Date(),
      analysisHash: "abc",
      sourceAnalysisRunId: null,
      summary: { failed: 0 },
      metrics: { plannedCount: 1 },
      milestoneId: 42,
      milestoneTitle: "Sprint 42",
      milestoneStartDate: "2026-07-06",
      milestoneDueDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      dryRun: true,
      projectIds: [10],
      triggerType: "MANUAL",
      runKey: "k",
      correlationId: "c",
      jobId: null,
      inputHash: "i",
      errorCode: null,
      errorMessage: null,
      startedAt: new Date(),
      requestedAt: new Date(),
      createdAt: new Date(),
    } as never);
    vi.mocked(
      sprintEvaluationRunRepository.findSuccessfulApplyForSource,
    ).mockResolvedValue(null);
    vi.mocked(db.sprintIssueEvaluation.count).mockResolvedValue(5);
    vi.mocked(db.sprintLabelAction.count).mockImplementation((async (args: {
      where?: {
        action?: string;
        status?: string | { in?: string[] };
      };
    }) => {
      const where = args?.where;
      if (where?.action === "ADD" && where.status === "PLANNED") return 1;
      if (where?.action === "REMOVE" && where.status === "PLANNED") return 1;
      if (
        typeof where?.status === "object" &&
        where.status?.in?.includes("FAILED")
      ) {
        return 0;
      }
      if (where?.status === "FAILED") return 0;
      return 2;
    }) as typeof db.sprintLabelAction.count);

    const detail = await service.getRunDetail("run-1");
    expect(detail?.applyEligible).toBe(true);
    expect(detail?.actionEligibility.applyEligible).toBe(true);
    expect(detail?.actionableLabelChanges).toBe(2);
  });

  it("marks apply ineligible when dry-run-only", async () => {
    process.env.SPRINT_INTELLIGENCE_ENABLED = "true";
    process.env.SPRINT_INTELLIGENCE_DRY_RUN_ONLY = "true";

    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue({
      id: "run-1",
      mode: "ANALYZE",
      status: "COMPLETED",
      completedAt: new Date(),
      analysisHash: "abc",
      sourceAnalysisRunId: null,
      summary: {},
      metrics: {},
      milestoneId: 42,
      milestoneTitle: "Sprint 42",
      milestoneStartDate: "2026-07-06",
      milestoneDueDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      dryRun: true,
      projectIds: [10],
      triggerType: "MANUAL",
      runKey: "k",
      correlationId: "c",
      jobId: null,
      inputHash: "i",
      errorCode: null,
      errorMessage: null,
      startedAt: new Date(),
      requestedAt: new Date(),
      createdAt: new Date(),
    } as never);
    vi.mocked(
      sprintEvaluationRunRepository.findSuccessfulApplyForSource,
    ).mockResolvedValue(null);
    vi.mocked(db.sprintIssueEvaluation.count).mockResolvedValue(1);
    vi.mocked(db.sprintLabelAction.count).mockResolvedValue(1);

    const detail = await service.getRunDetail("run-1");
    expect(detail?.applyEligible).toBe(false);
    expect(detail?.actionEligibility.reasons).toContain("DRY_RUN_ONLY");
  });

  it("filters issues by planning status and search", async () => {
    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue({
      id: "run-1",
    } as never);
    vi.mocked(db.sprintIssueEvaluation.count).mockResolvedValue(1);
    vi.mocked(db.sprintIssueEvaluation.findMany).mockResolvedValue([
      {
        id: "ev-1",
        projectId: 10,
        issueId: 100,
        issueIid: 12,
        issueTitle: "Fix login",
        planningStatus: "Planned",
        deliveryStatus: "Committed",
        workTypes: ["Bug"],
        assignmentTimestamp: null,
        completionTimestamp: null,
        existingLabels: ["bug"],
        recommendedLabelsToAdd: ["sprint::committed"],
        recommendedManagedLabelsToRemove: [],
        reasonCodes: ["ASSIGNED_BEFORE_SPRINT_BOUNDARY"],
        excludedFromCommitment: false,
        completedWithinSprint: true,
        evaluationErrorCode: null,
        evaluationErrorMessage: null,
      },
    ] as never);
    vi.mocked(db.gitLabProject.findMany).mockResolvedValue([
      { gitlabId: 10, webUrl: "https://gitlab.example.com/group/proj" },
    ] as never);

    const result = await service.listIssues("run-1", {
      planningStatus: "Planned",
      search: "12",
      page: 1,
      pageSize: 25,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].issueWebUrl).toBe(
      "https://gitlab.example.com/group/proj/-/issues/12",
    );
    expect(db.sprintIssueEvaluation.findMany).toHaveBeenCalled();
  });

  it("rejects unknown run for issue list", async () => {
    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue(null);
    await expect(service.listIssues("missing", {})).rejects.toThrow(
      "RUN_NOT_FOUND",
    );
  });

  it("exports CSV with formula sanitization and filename", async () => {
    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue({
      id: "run-1",
      milestoneTitle: "Sprint 42",
      completedAt: new Date("2026-07-16T10:00:00Z"),
      requestedAt: new Date("2026-07-16T09:00:00Z"),
    } as never);
    vi.mocked(db.sprintIssueEvaluation.findMany).mockResolvedValue([
      {
        projectId: 10,
        issueIid: 1,
        issueTitle: "=CMD()",
        planningStatus: "Planned",
        deliveryStatus: "Committed",
        workTypes: ["Bug"],
        assignmentTimestamp: null,
        completionTimestamp: null,
        excludedFromCommitment: false,
        completedWithinSprint: true,
        existingLabels: [],
        recommendedLabelsToAdd: [],
        recommendedManagedLabelsToRemove: [],
        reasonCodes: [],
        evaluationErrorCode: null,
      },
    ] as never);

    const exported = await service.exportIssuesCsv("run-1");
    expect(exported.filename).toContain("sprint-intelligence-sprint-42");
    expect(exported.csv).toContain(`"'=CMD()"`);
  });

  it("throws for missing export run", async () => {
    vi.mocked(sprintEvaluationRunRepository.getById).mockResolvedValue(null);
    await expect(service.exportIssuesCsv("missing")).rejects.toThrow(
      "RUN_NOT_FOUND",
    );
  });
});
