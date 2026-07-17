import { describe, expect, it } from "vitest";

import type { Sprint } from "@prisma/client";

import { resolveEffectiveSprintIntelligenceConfig } from "@/lib/sprint-intelligence-config";

import { determineDueTriggers } from "./sprint-intelligence-discovery.service";

function sprint(partial: Partial<Sprint> & Pick<Sprint, "startDate" | "endDate">): Sprint {
  return {
    id: "s1",
    teamId: "t1",
    projectId: null,
    gitlabMilestoneId: 100,
    name: "Sprint 42",
    goal: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("determineDueTriggers", () => {
  const effective = resolveEffectiveSprintIntelligenceConfig(null, {
    enabled: true,
    dryRunOnly: true,
    discoveryEnabled: true,
    discoveryIntervalMinutes: 15,
    duringSprintIntervalMinutes: 60,
    postSprintReconciliationHours: 24,
    workerConcurrency: 2,
    jobAttempts: 3,
    jobBackoffMs: 5000,
    maxAnalysisAgeMinutes: 15,
    createMissingLabels: false,
    autoApply: false,
    timezone: "Asia/Kolkata",
    allowFirstDayAdditions: true,
    supportExcludedFromCommitment: true,
    hotfixExcludedFromCommitment: true,
    uatExcludedFromCommitment: false,
    maxConcurrency: 5,
  });

  it("1. sprint start is due after planning boundary", () => {
    const due = determineDueTriggers(
      sprint({
        startDate: new Date("2026-07-06T00:00:00.000Z"),
        endDate: new Date("2026-07-17T00:00:00.000Z"),
      }),
      new Date("2026-07-07T00:00:00.000Z"),
      effective,
    );
    expect(due).toContain("SPRINT_START");
    expect(due).toContain("DURING_SPRINT");
  });

  it("5. sprint end is due after end boundary", () => {
    const due = determineDueTriggers(
      sprint({
        startDate: new Date("2026-07-06T00:00:00.000Z"),
        endDate: new Date("2026-07-17T00:00:00.000Z"),
      }),
      new Date("2026-07-18T12:00:00.000Z"),
      effective,
    );
    expect(due).toContain("SPRINT_END");
    expect(due).not.toContain("DURING_SPRINT");
  });

  it("10. post-sprint reconciliation after configured delay", () => {
    const due = determineDueTriggers(
      sprint({
        startDate: new Date("2026-07-06T00:00:00.000Z"),
        endDate: new Date("2026-07-17T00:00:00.000Z"),
      }),
      new Date("2026-07-19T12:00:00.000Z"),
      effective,
    );
    expect(due).toContain("POST_SPRINT_RECONCILIATION");
  });

  it("does not schedule before sprint start", () => {
    const due = determineDueTriggers(
      sprint({
        startDate: new Date("2026-07-06T00:00:00.000Z"),
        endDate: new Date("2026-07-17T00:00:00.000Z"),
      }),
      new Date("2026-07-05T00:00:00.000Z"),
      effective,
    );
    expect(due).toEqual([]);
  });
});
