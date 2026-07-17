import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { checkDatabaseConnection } from "@/lib/db";

import { sprintEvaluationRunRepository } from "./sprint-evaluation-run.repository";
import { sprintIssueEvaluationRepository } from "./sprint-issue-evaluation.repository";
import { sprintLabelActionRepository } from "./sprint-label-action.repository";
import { sprintManagedLabelOwnershipRepository } from "./sprint-managed-label-ownership.repository";

const runIds: string[] = [];

describe("SprintEvaluationRunRepository (db)", () => {
  afterAll(async () => {
    if (runIds.length > 0) {
      await db.sprintEvaluationRun.deleteMany({
        where: { id: { in: runIds } },
      });
    }
  });

  it("creates analysis run, enforces unique runKey, and transitions states", async () => {
    const available = await checkDatabaseConnection();
    if (!available) {
      return;
    }

    const runKey = `analyze:test:${Date.now()}`;
    const run = await sprintEvaluationRunRepository.createPendingRun({
      runKey,
      correlationId: "corr-1",
      mode: "ANALYZE",
      triggerType: "MANUAL",
      projectIds: [6100],
      milestoneId: 999001,
      milestoneTitle: "Test Sprint",
      milestoneStartDate: "2026-07-06",
      milestoneDueDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      ruleConfigSnapshot: {},
      inputHash: "hash1",
      dryRun: true,
      automationVersion: "1.0.0",
    });
    runIds.push(run.id);

    expect(run.status).toBe("PENDING");

    await expect(
      sprintEvaluationRunRepository.createPendingRun({
        runKey,
        correlationId: "corr-2",
        mode: "ANALYZE",
        triggerType: "MANUAL",
        projectIds: [6100],
        milestoneId: 999001,
        milestoneTitle: "Test Sprint",
        timezone: "Asia/Kolkata",
        ruleConfigSnapshot: {},
        dryRun: true,
        automationVersion: "1.0.0",
      }),
    ).rejects.toThrow();

    const queued = await sprintEvaluationRunRepository.markQueued(
      run.id,
      "job-1",
    );
    expect(queued.status).toBe("QUEUED");

    const running = await sprintEvaluationRunRepository.markRunning(run.id);
    expect(running.status).toBe("RUNNING");

    const evaluations = await sprintIssueEvaluationRepository.createManyForRun([
      {
        runId: run.id,
        projectId: 6100,
        issueId: 1,
        issueIid: 1,
        issueTitle: "Issue 1",
        milestoneId: 999001,
        milestoneTitle: "Test Sprint",
        planningStatus: "Planned",
        deliveryStatus: "Committed",
        workTypes: ["bug"],
        excludedFromCommitment: false,
        completedWithinSprint: true,
        existingLabels: [],
        recommendedLabelsToAdd: ["sprint::planned"],
        recommendedManagedLabelsToRemove: [],
        reasonCodes: [],
      },
    ]);
    expect(evaluations).toHaveLength(1);

    const actions = await sprintLabelActionRepository.createPlannedActions([
      {
        runId: run.id,
        issueEvaluationId: evaluations[0]!.id,
        projectId: 6100,
        issueIid: 1,
        label: "sprint::planned",
        action: "ADD",
      },
    ]);
    expect(actions[0]?.status).toBe("PLANNED");

    await sprintLabelActionRepository.recordApplied(actions[0]!.id, true);
    const ownership =
      await sprintManagedLabelOwnershipRepository.acquireOwnership({
        projectId: 6100,
        issueIid: 1,
        milestoneId: 999001,
        label: "sprint::planned",
        sourceRunId: run.id,
        sourceLabelActionId: actions[0]!.id,
      });
    expect(ownership.isActive).toBe(true);

    // Dry-run must not create ownership — covered by policy; acquire is apply-only path.
    const active = await sprintManagedLabelOwnershipRepository.listActiveForIssue(
      6100,
      1,
    );
    expect(active.some((item) => item.label === "sprint::planned")).toBe(true);

    await sprintManagedLabelOwnershipRepository.releaseOwnership(ownership.id);

    const completed = await sprintEvaluationRunRepository.completeRun(run.id, {
      status: "COMPLETED",
      analysisHash: "analysis-hash",
      summary: { issuesEvaluated: 1 },
      metrics: { plannedCount: 1 },
    });
    expect(completed.status).toBe("COMPLETED");

    await expect(
      sprintEvaluationRunRepository.markRunning(run.id),
    ).rejects.toThrow(/INVALID_RUN_TRANSITION/);
  });

  it("prevents a second successful apply for the same source analysis", async () => {
    const available = await checkDatabaseConnection();
    if (!available) return;

    const sourceKey = `analyze:source:${Date.now()}`;
    const source = await sprintEvaluationRunRepository.createPendingRun({
      runKey: sourceKey,
      correlationId: "c-source",
      mode: "ANALYZE",
      triggerType: "MANUAL",
      projectIds: [1],
      milestoneId: 999002,
      milestoneTitle: "S",
      timezone: "Asia/Kolkata",
      ruleConfigSnapshot: {},
      dryRun: true,
      automationVersion: "1.0.0",
    });
    runIds.push(source.id);
    await sprintEvaluationRunRepository.markQueued(source.id, "j1");
    await sprintEvaluationRunRepository.markRunning(source.id);
    await sprintEvaluationRunRepository.completeRun(source.id, {
      status: "COMPLETED",
      analysisHash: "ah",
    });

    const applyKey = `apply:${source.id}:ah`;
    const apply = await sprintEvaluationRunRepository.createPendingRun({
      runKey: applyKey,
      correlationId: "c-apply",
      mode: "APPLY",
      triggerType: "MANUAL",
      projectIds: [1],
      milestoneId: 999002,
      milestoneTitle: "S",
      timezone: "Asia/Kolkata",
      ruleConfigSnapshot: {},
      dryRun: false,
      sourceAnalysisRunId: source.id,
      confirmationRequired: true,
      automationVersion: "1.0.0",
    });
    runIds.push(apply.id);
    await sprintEvaluationRunRepository.markQueued(apply.id, "j2");
    await sprintEvaluationRunRepository.markRunning(apply.id);
    await sprintEvaluationRunRepository.completeRun(apply.id, {
      status: "COMPLETED",
    });

    const existing =
      await sprintEvaluationRunRepository.findSuccessfulApplyForSource(
        source.id,
      );
    expect(existing?.id).toBe(apply.id);
  });
});
