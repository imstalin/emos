import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SPRINT_INTELLIGENCE_CONFIG } from "@/domain/sprint-intelligence";
import type {
  GitLabIssue,
  GitLabLabel,
  GitLabResourceMilestoneEvent,
} from "@/domain/types/gitlab";
import type { SprintMilestoneAnalysisResult } from "@/domain/types/sprint-intelligence-gitlab";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";

import { SprintIntelligenceGitLabService } from "./sprint-intelligence-gitlab.service";

const milestone = {
  id: 100,
  title: "Sprint 42",
  startDate: "2026-07-06",
  dueDate: "2026-07-17",
};

function issue(partial: Partial<GitLabIssue> & Pick<GitLabIssue, "iid" | "project_id">): GitLabIssue {
  return {
    id: partial.iid * 100,
    title: `Issue ${partial.iid}`,
    description: null,
    state: "opened",
    labels: [],
    milestone: {
      id: milestone.id,
      title: milestone.title,
      start_date: milestone.startDate,
      due_date: milestone.dueDate,
    },
    assignee: null,
    assignees: [{ id: 1, username: "dev", name: "Dev" }],
    due_date: null,
    web_url: "https://example",
    updated_at: "2026-07-10T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
    closed_at: null,
    weight: null,
    ...partial,
  };
}

function addEvent(
  overrides: Partial<GitLabResourceMilestoneEvent> &
    Pick<GitLabResourceMilestoneEvent, "id" | "createdAt" | "action">,
): GitLabResourceMilestoneEvent {
  return {
    milestone: {
      id: milestone.id,
      title: milestone.title,
      startDate: milestone.startDate,
      dueDate: milestone.dueDate,
    },
    user: { id: 1, username: "planner", name: "Planner" },
    ...overrides,
  };
}

function createMockGitlab(overrides: Partial<GitLabProvider> = {}): GitLabProvider {
  return {
    listProjectIssues: vi.fn().mockResolvedValue([]),
    listIssueResourceMilestoneEvents: vi.fn().mockResolvedValue([]),
    listProjectLabels: vi.fn().mockResolvedValue([]),
    ensureProjectLabels: vi.fn().mockResolvedValue({
      existing: [],
      created: [],
      missing: [],
      failed: [],
    }),
    getIssue: vi.fn(),
    updateIssueLabels: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as GitLabProvider;
}

describe("SprintIntelligenceGitLabService", () => {
  it("1/3/4. analyzes a single-project sprint for planned and unplanned issues", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockResolvedValue([
        issue({
          iid: 1,
          project_id: 6100,
          state: "closed",
          closed_at: "2026-07-14T10:00:00.000+05:30",
          labels: ["Type::Enhancement"],
        }),
        issue({
          iid: 2,
          project_id: 6100,
          labels: ["Type::Defect"],
        }),
      ]),
      listIssueResourceMilestoneEvents: vi.fn().mockImplementation(
        async (_projectId, issueIid: number) => {
          if (issueIid === 1) {
            return [addEvent({ id: 1, action: "add", createdAt: "2026-07-05T10:00:00.000+05:30" })];
          }
          return [addEvent({ id: 2, action: "add", createdAt: "2026-07-10T10:00:00.000+05:30" })];
        },
      ),
      listProjectLabels: vi.fn().mockResolvedValue([
        { id: 1, name: "sprint::planned", color: "#428BCA", description: null },
      ] satisfies GitLabLabel[]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [6100],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
    });

    expect(result.mode).toBe("dry-run");
    expect(result.summary.issuesEvaluated).toBe(2);
    expect(result.evaluations[0]?.planningStatus).toBe("Planned");
    expect(result.evaluations[0]?.deliveryStatus).toBe("Committed");
    expect(result.evaluations[1]?.planningStatus).toBe("Unplanned");
    expect(result.metrics.committedCount).toBe(1);
    expect(result.metrics.unplannedCount).toBe(1);
    expect(gitlab.updateIssueLabels).not.toHaveBeenCalled();
    expect(gitlab.ensureProjectLabels).not.toHaveBeenCalled();
    expect(gitlab.listProjectIssues).toHaveBeenCalledWith(
      6100,
      "all",
      expect.objectContaining({
        milestone: milestone.title,
      }),
    );
    const listOptions = vi.mocked(gitlab.listProjectIssues).mock.calls[0]?.[2] as
      | Record<string, unknown>
      | undefined;
    expect(listOptions).not.toHaveProperty("milestoneId");
    expect(listOptions).not.toHaveProperty("milestoneTimebox");
  });

  it("2. analyzes multi-project group milestone", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockImplementation(async (projectId: number) => [
        issue({
          iid: projectId === 1 ? 1 : 2,
          project_id: projectId,
          labels: ["Type::Enhancement"],
        }),
      ]),
      listIssueResourceMilestoneEvents: vi.fn().mockResolvedValue([
        addEvent({ id: 1, action: "add", createdAt: "2026-07-05T10:00:00.000+05:30" }),
      ]),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [1, 2],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
    });

    expect(result.summary.projectsProcessed).toBe(2);
    expect(result.summary.issuesEvaluated).toBe(2);
    expect(result.evaluations.map((item) => item.projectId).sort()).toEqual([1, 2]);
  });

  it("5. removed and reassigned uses latest assignment", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockResolvedValue([
        issue({ iid: 5, project_id: 1, labels: [] }),
      ]),
      listIssueResourceMilestoneEvents: vi.fn().mockResolvedValue([
        addEvent({ id: 1, action: "add", createdAt: "2026-07-01T10:00:00.000+05:30" }),
        addEvent({ id: 2, action: "remove", createdAt: "2026-07-03T10:00:00.000+05:30" }),
        addEvent({ id: 3, action: "add", createdAt: "2026-07-12T10:00:00.000+05:30" }),
      ]),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
    });

    expect(result.evaluations[0]?.planningStatus).toBe("Unplanned");
    expect(result.evaluations[0]?.reasonCodes).toContain(
      "MILESTONE_REMOVED_AND_REASSIGNED",
    );
  });

  it("6. missing event history yields UnableToDetermine", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockResolvedValue([
        issue({ iid: 6, project_id: 1 }),
      ]),
      listIssueResourceMilestoneEvents: vi.fn().mockResolvedValue([]),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
    });

    expect(result.evaluations[0]?.planningStatus).toBe("UnableToDetermine");
    expect(result.summary.unableToDetermine).toBe(1);
  });

  it("7. one event-fetch failure does not stop the run", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockResolvedValue([
        issue({ iid: 1, project_id: 1 }),
        issue({ iid: 2, project_id: 1 }),
      ]),
      listIssueResourceMilestoneEvents: vi.fn().mockImplementation(
        async (_p, iid: number) => {
          if (iid === 1) throw new Error("boom");
          return [
            addEvent({ id: 1, action: "add", createdAt: "2026-07-05T10:00:00.000+05:30" }),
          ];
        },
      ),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
    });

    expect(result.summary.issuesEvaluated).toBe(2);
    expect(result.failures.some((f) => f.code === "MILESTONE_EVENT_FETCH_FAILED")).toBe(
      true,
    );
    expect(result.evaluations.find((e) => e.issueIid === 2)?.planningStatus).toBe(
      "Planned",
    );
  });

  it("8. one project access failure does not stop other projects", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockImplementation(async (projectId: number) => {
        if (projectId === 1) throw new Error("forbidden");
        return [issue({ iid: 9, project_id: 2 })];
      }),
      listIssueResourceMilestoneEvents: vi.fn().mockResolvedValue([
        addEvent({ id: 1, action: "add", createdAt: "2026-07-05T10:00:00.000+05:30" }),
      ]),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [1, 2],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
    });

    expect(result.summary.projectsProcessed).toBe(1);
    expect(result.summary.issuesEvaluated).toBe(1);
    expect(result.failures[0]?.code).toBe("PROJECT_ACCESS_FAILED");
  });

  it("9. uses controlled concurrency for event fetches", async () => {
    let active = 0;
    let maxActive = 0;
    const issues = Array.from({ length: 6 }, (_, i) =>
      issue({ iid: i + 1, project_id: 1 }),
    );

    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockResolvedValue(issues),
      listIssueResourceMilestoneEvents: vi.fn().mockImplementation(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return [
          addEvent({ id: 1, action: "add", createdAt: "2026-07-05T10:00:00.000+05:30" }),
        ];
      }),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    await service.analyzeMilestone({
      projectIds: [1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: false,
      maxConcurrency: 2,
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("10/11. dry-run performs zero writes and reports missing labels", async () => {
    const gitlab = createMockGitlab({
      listProjectIssues: vi.fn().mockResolvedValue([
        issue({ iid: 1, project_id: 6100 }),
      ]),
      listIssueResourceMilestoneEvents: vi.fn().mockResolvedValue([
        addEvent({ id: 1, action: "add", createdAt: "2026-07-05T10:00:00.000+05:30" }),
      ]),
      listProjectLabels: vi.fn().mockResolvedValue([]),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const result = await service.analyzeMilestone({
      projectIds: [6100],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
      createMissingLabels: true,
    });

    expect(result.missingLabelsByProject["6100"]).toEqual(
      expect.arrayContaining(["sprint::planned", "unplanned"]),
    );
    expect(gitlab.ensureProjectLabels).not.toHaveBeenCalled();
    expect(gitlab.updateIssueLabels).not.toHaveBeenCalled();
  });

  it("12. apply requires explicit confirmation", async () => {
    const service = new SprintIntelligenceGitLabService(createMockGitlab());
    await expect(
      service.applyMilestoneAnalysis({
        analysis: {
          mode: "dry-run",
          completedAt: new Date().toISOString(),
        } as SprintMilestoneAnalysisResult,
        confirm: false as unknown as true,
        createMissingLabels: false,
      }),
    ).rejects.toThrow(/CONFIRMATION_REQUIRED/);
  });

  it("19. apply rejects stale analysis", async () => {
    const service = new SprintIntelligenceGitLabService(createMockGitlab());
    await expect(
      service.applyMilestoneAnalysis({
        analysis: {
          mode: "dry-run",
          completedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
          evaluations: [],
          labelPlans: [],
          managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
          milestone,
        } as unknown as SprintMilestoneAnalysisResult,
        confirm: true,
        createMissingLabels: false,
        maxAnalysisAgeMinutes: 15,
      }),
    ).rejects.toThrow(/STALE_ANALYSIS/);
  });

  it("13/15/16/17/18/20. apply creates labels, mutates idempotently, continues on failure", async () => {
    const analysis: SprintMilestoneAnalysisResult = {
      milestone,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      mode: "dry-run",
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: {
        plannedCount: 2,
        plannedCompletedCount: 1,
        committedCount: 1,
        spilloverCount: 0,
        unplannedCount: 0,
        completedUnplannedCount: 0,
        regressionCount: 0,
        plannedRegressionCount: 0,
        unplannedRegressionCount: 0,
        supportCount: 0,
        hotfixCount: 0,
        bugCount: 0,
        enhancementCount: 0,
        technicalDebtCount: 0,
        releaseValidationCount: 0,
        deploymentCount: 0,
        functionalTestingCount: 0,
        uatCount: 0,
        commitmentReliabilityPercent: 100,
        spilloverPercent: 0,
        unplannedWorkPercent: 0,
        completedUnplannedPercent: null,
        regressionSharePercent: 0,
      },
      evaluations: [
        {
          projectId: 1,
          issueId: 100,
          issueIid: 1,
          title: "A",
          state: "closed",
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          assignmentTimestamp: new Date(),
          milestoneRemovalTimestamp: null,
          assignmentUserId: null,
          assignmentUserName: null,
          sprintStart: new Date(),
          sprintEnd: new Date(),
          planningStatus: "Planned",
          deliveryStatus: "Committed",
          workTypes: ["enhancement"],
          excludedFromCommitment: false,
          completedWithinSprint: true,
          existingLabels: ["Type::Enhancement"],
          labelsToAdd: ["sprint::planned", "sprint::committed"],
          managedLabelsToRemove: [],
          reasonCodes: [],
          evaluatedAt: new Date(),
          assignees: [],
          closedAt: new Date(),
        },
        {
          projectId: 1,
          issueId: 200,
          issueIid: 2,
          title: "B",
          state: "closed",
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          assignmentTimestamp: new Date(),
          milestoneRemovalTimestamp: null,
          assignmentUserId: null,
          assignmentUserName: null,
          sprintStart: new Date(),
          sprintEnd: new Date(),
          planningStatus: "Planned",
          deliveryStatus: "Committed",
          workTypes: ["enhancement"],
          excludedFromCommitment: false,
          completedWithinSprint: true,
          existingLabels: ["sprint::planned", "sprint::committed"],
          labelsToAdd: [],
          managedLabelsToRemove: [],
          reasonCodes: [],
          evaluatedAt: new Date(),
          assignees: [],
          closedAt: new Date(),
        },
        {
          projectId: 1,
          issueId: 300,
          issueIid: 3,
          title: "C",
          state: "opened",
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          assignmentTimestamp: new Date(),
          milestoneRemovalTimestamp: null,
          assignmentUserId: null,
          assignmentUserName: null,
          sprintStart: new Date(),
          sprintEnd: new Date(),
          planningStatus: "Planned",
          deliveryStatus: "Spillover",
          workTypes: ["bug"],
          excludedFromCommitment: false,
          completedWithinSprint: false,
          existingLabels: ["sprint::committed"],
          labelsToAdd: ["sprint::planned", "sprint::spillover"],
          managedLabelsToRemove: ["sprint::committed"],
          reasonCodes: [],
          evaluatedAt: new Date(),
          assignees: [],
          closedAt: null,
        },
      ],
      labelPlans: [
        {
          projectId: 1,
          issueIid: 1,
          labelsToAdd: ["sprint::planned", "sprint::committed"],
          labelsToRemove: [],
        },
        {
          projectId: 1,
          issueIid: 2,
          labelsToAdd: [],
          labelsToRemove: [],
        },
        {
          projectId: 1,
          issueIid: 3,
          labelsToAdd: ["sprint::planned", "sprint::spillover"],
          labelsToRemove: ["sprint::committed"],
        },
      ],
      missingLabelsByProject: {},
      failures: [],
      summary: {
        projectsProcessed: 1,
        issuesRetrieved: 3,
        issuesEvaluated: 3,
        unableToDetermine: 0,
        skipped: 0,
        failed: 0,
      },
    };

    const gitlab = createMockGitlab({
      ensureProjectLabels: vi.fn().mockResolvedValue({
        existing: [],
        created: ["sprint::planned"],
        missing: ["sprint::planned"],
        failed: [],
      }),
      getIssue: vi.fn().mockImplementation(async (_p, iid: number) => {
        if (iid === 1) {
          return issue({
            iid: 1,
            project_id: 1,
            labels: ["Type::Enhancement"],
          });
        }
        if (iid === 2) {
          return issue({
            iid: 2,
            project_id: 1,
            labels: ["sprint::planned", "sprint::committed"],
          });
        }
        return issue({
          iid: 3,
          project_id: 1,
          labels: ["sprint::committed", "Type::Defect"],
        });
      }),
      updateIssueLabels: vi.fn().mockImplementation(async (_p, iid: number) => {
        if (iid === 3) throw new Error("write failed");
        return issue({ iid, project_id: 1 });
      }),
    });

    const service = new SprintIntelligenceGitLabService(gitlab);
    const applyResult = await service.applyMilestoneAnalysis({
      analysis,
      confirm: true,
      createMissingLabels: true,
      automationOwnedLabels: {
        "1:3": ["sprint::committed"],
      },
    });

    expect(applyResult.createdLabels["1"]).toEqual(["sprint::planned"]);
    expect(applyResult.applied.some((item) => item.issueIid === 1)).toBe(true);
    expect(applyResult.skipped.some((item) => item.issueIid === 2)).toBe(true);
    expect(applyResult.failed.some((item) => item.issueIid === 3)).toBe(true);

    const firstMutation = vi.mocked(gitlab.updateIssueLabels).mock.calls.find(
      (call) => call[1] === 1,
    );
    expect(firstMutation?.[2]).toEqual({
      labelsToAdd: ["sprint::planned", "sprint::committed"],
      labelsToRemove: [],
    });
  });

  it("14. apply does not create labels when disabled", async () => {
    const gitlab = createMockGitlab({
      getIssue: vi.fn().mockResolvedValue(
        issue({ iid: 1, project_id: 1, labels: [] }),
      ),
      updateIssueLabels: vi.fn().mockResolvedValue(issue({ iid: 1, project_id: 1 })),
    });
    const service = new SprintIntelligenceGitLabService(gitlab);

    await service.applyMilestoneAnalysis({
      analysis: {
        mode: "dry-run",
        completedAt: new Date().toISOString(),
        managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
        evaluations: [
          {
            projectId: 1,
            issueIid: 1,
            planningStatus: "Planned",
            deliveryStatus: "Committed",
          },
        ],
        labelPlans: [
          {
            projectId: 1,
            issueIid: 1,
            labelsToAdd: ["sprint::planned"],
            labelsToRemove: [],
          },
        ],
        milestone,
      } as unknown as SprintMilestoneAnalysisResult,
      confirm: true,
      createMissingLabels: false,
    });

    expect(gitlab.ensureProjectLabels).not.toHaveBeenCalled();
  });
});
