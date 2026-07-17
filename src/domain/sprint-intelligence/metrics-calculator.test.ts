import { describe, expect, it } from "vitest";

import { evaluateSprintIssues } from "./classification-engine";
import { calculateSprintMetrics } from "./metrics-calculator";
import {
  addEvent,
  config,
  ist,
  issue,
  SPRINT,
} from "./test-helpers";
import type { SprintIssueEvaluation } from "@/domain/types/sprint-intelligence";

function evalAll(
  issues: ReturnType<typeof issue>[],
  cfg = config(),
): SprintIssueEvaluation[] {
  return evaluateSprintIssues(issues, SPRINT, cfg, {
    evaluatedAt: new Date("2026-07-18T06:00:00.000Z"),
  });
}

describe("calculateSprintMetrics", () => {
  it("computes commitment reliability excluding support/hotfix", () => {
    const evaluations = evalAll([
      issue({
        issueIid: 1,
        state: "closed",
        closedAt: ist("2026-07-14"),
        labels: ["Type::Enhancement"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
      issue({
        issueIid: 2,
        state: "opened",
        labels: ["Type::Enhancement"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
      issue({
        issueIid: 3,
        state: "closed",
        closedAt: ist("2026-07-14"),
        labels: ["Type::Support"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    ]);

    const metrics = calculateSprintMetrics(evaluations);
    expect(metrics.plannedCount).toBe(3);
    expect(metrics.committedCount).toBe(1);
    expect(metrics.supportCount).toBe(1);
    // Eligible planned = 2 (support excluded); completed eligible = 1 → 50%
    expect(metrics.commitmentReliabilityPercent).toBe(50);
    expect(metrics.spilloverPercent).toBe(50);
  });

  it("counts regression share separately", () => {
    const evaluations = evalAll([
      issue({
        issueIid: 1,
        labels: ["qa::regression"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
      issue({
        issueIid: 2,
        labels: ["qa::regression"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-12") }),
        ],
      }),
      issue({
        issueIid: 3,
        labels: ["Type::Enhancement"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    ]);

    const metrics = calculateSprintMetrics(evaluations);
    expect(metrics.regressionCount).toBe(2);
    expect(metrics.plannedRegressionCount).toBe(1);
    expect(metrics.unplannedRegressionCount).toBe(1);
    expect(metrics.regressionSharePercent).toBeCloseTo((2 / 3) * 100);
  });

  it("26. returns null percentages when denominators are zero", () => {
    const metrics = calculateSprintMetrics([]);
    expect(metrics.commitmentReliabilityPercent).toBeNull();
    expect(metrics.spilloverPercent).toBeNull();
    expect(metrics.unplannedWorkPercent).toBeNull();
    expect(metrics.completedUnplannedPercent).toBeNull();
    expect(metrics.regressionSharePercent).toBeNull();
  });

  it("counts unplanned and completed-unplanned percentages", () => {
    const evaluations = evalAll([
      issue({
        issueIid: 1,
        state: "closed",
        closedAt: ist("2026-07-14"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
      issue({
        issueIid: 2,
        state: "closed",
        closedAt: ist("2026-07-15"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-12") }),
        ],
      }),
      issue({
        issueIid: 3,
        state: "opened",
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-12") }),
        ],
      }),
    ]);

    const metrics = calculateSprintMetrics(evaluations);
    expect(metrics.unplannedCount).toBe(2);
    expect(metrics.completedUnplannedCount).toBe(1);
    expect(metrics.unplannedWorkPercent).toBeCloseTo((2 / 3) * 100);
    // completed sprint issues = committed(1) + completedUnplanned(1) = 2
    expect(metrics.completedUnplannedPercent).toBe(50);
  });
});
