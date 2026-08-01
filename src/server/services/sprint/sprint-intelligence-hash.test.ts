import { describe, expect, it } from "vitest";

import { DEFAULT_SPRINT_INTELLIGENCE_CONFIG } from "@/domain/sprint-intelligence";

import {
  buildAnalyzeRunKey,
  buildApplyRunKey,
  canonicalizeJson,
  hashSprintAnalysisInput,
  hashSprintAnalysisResult,
  normalizeJsonNumber,
  toIsoTimestamp,
  withUniqueRunKeySuffix,
} from "./sprint-intelligence-hash";

describe("sprint-intelligence hashing", () => {
  const milestone = {
    id: 100,
    title: "Sprint 42",
    startDate: "2026-07-06",
    dueDate: "2026-07-17",
  };

  it("1/2. same semantic input and different key order produce the same hash", () => {
    const a = hashSprintAnalysisInput({
      projectIds: [2, 1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    });
    const b = hashSprintAnalysisInput({
      projectIds: [1, 2],
      milestone: {
        dueDate: milestone.dueDate,
        startDate: milestone.startDate,
        title: milestone.title,
        id: milestone.id,
      },
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    });
    expect(a).toBe(b);
    expect(
      canonicalizeJson({ b: 1, a: 2 }),
    ).toBe(canonicalizeJson({ a: 2, b: 1 }));
  });

  it("3. different labels / managed labels produce different hash", () => {
    const base = hashSprintAnalysisResult({
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: {
        plannedCount: 1,
      } as never,
      summary: { issuesEvaluated: 1 } as never,
      labelPlans: [
        {
          projectId: 1,
          issueIid: 1,
          labelsToAdd: ["sprint::planned"],
          labelsToRemove: [],
        },
      ],
      evaluations: [],
    });
    const changed = hashSprintAnalysisResult({
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: {
        plannedCount: 1,
      } as never,
      summary: { issuesEvaluated: 1 } as never,
      labelPlans: [
        {
          projectId: 1,
          issueIid: 1,
          labelsToAdd: ["sprint::planned", "unplanned"],
          labelsToRemove: [],
        },
      ],
      evaluations: [],
    });
    expect(base).not.toBe(changed);
  });

  it("4. different rule config produces different input hash", () => {
    const a = hashSprintAnalysisInput({
      projectIds: [1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    });
    const b = hashSprintAnalysisInput({
      projectIds: [1],
      milestone,
      ruleConfig: {
        ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
        allowFirstDayAdditions: false,
      },
    });
    expect(a).not.toBe(b);
  });

  it("5. different milestone produces different hash", () => {
    const a = hashSprintAnalysisInput({
      projectIds: [1],
      milestone,
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    });
    const b = hashSprintAnalysisInput({
      projectIds: [1],
      milestone: { ...milestone, id: 101 },
      ruleConfig: DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    });
    expect(a).not.toBe(b);
  });

  it("6/7. tampering with persisted result changes hash (apply would reject)", () => {
    const original = hashSprintAnalysisResult({
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: { plannedCount: 1 } as never,
      summary: { issuesEvaluated: 1 } as never,
      labelPlans: [],
      evaluations: [
        {
          projectId: 1,
          issueId: 10,
          issueIid: 1,
          planningStatus: "Planned",
          deliveryStatus: "Committed",
          workTypes: ["bug"],
          excludedFromCommitment: false,
          completedWithinSprint: true,
          existingLabels: [],
          labelsToAdd: ["sprint::planned"],
          managedLabelsToRemove: [],
          reasonCodes: [],
          assignmentTimestamp: null,
          closedAt: null,
        } as never,
      ],
    });
    const tampered = hashSprintAnalysisResult({
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: { plannedCount: 1 } as never,
      summary: { issuesEvaluated: 1 } as never,
      labelPlans: [],
      evaluations: [
        {
          projectId: 1,
          issueId: 10,
          issueIid: 1,
          planningStatus: "Unplanned",
          deliveryStatus: "Committed",
          workTypes: ["bug"],
          excludedFromCommitment: false,
          completedWithinSprint: true,
          existingLabels: [],
          labelsToAdd: ["unplanned"],
          managedLabelsToRemove: [],
          reasonCodes: [],
          assignmentTimestamp: null,
          closedAt: null,
        } as never,
      ],
    });
    expect(original).not.toBe(tampered);
  });

  it("builds distinct analyze/apply run keys", () => {
    const analyze = buildAnalyzeRunKey({
      milestoneId: 1,
      projectIds: [1, 2],
      inputHash: "abc",
      triggerType: "SPRINT_START",
    });
    const apply = buildApplyRunKey({
      sourceAnalysisRunId: "run1",
      analysisHash: "def",
    });
    expect(analyze.startsWith("analyze:")).toBe(true);
    expect(apply.startsWith("apply:")).toBe(true);
  });

  it("allocates unique attempt suffixes for retry run keys", () => {
    const base = "analyze:1:abc:MANUAL:default:hash";
    const a = withUniqueRunKeySuffix(base);
    const b = withUniqueRunKeySuffix(base);
    expect(a.startsWith(`${base}:attempt:`)).toBe(true);
    expect(b.startsWith(`${base}:attempt:`)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("includes empty label plans so apply rebuild matches analyze", () => {
    const withEmptyPlans = hashSprintAnalysisResult({
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: { plannedCount: 2 } as never,
      summary: { issuesEvaluated: 2 } as never,
      labelPlans: [
        {
          projectId: 1,
          issueIid: 1,
          labelsToAdd: ["sprint::planned"],
          labelsToRemove: [],
        },
        {
          projectId: 1,
          issueIid: 2,
          labelsToAdd: [],
          labelsToRemove: [],
        },
      ],
      evaluations: [],
    });
    const actionsOnly = hashSprintAnalysisResult({
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: { plannedCount: 2 } as never,
      summary: { issuesEvaluated: 2 } as never,
      labelPlans: [
        {
          projectId: 1,
          issueIid: 1,
          labelsToAdd: ["sprint::planned"],
          labelsToRemove: [],
        },
      ],
      evaluations: [],
    });
    expect(withEmptyPlans).not.toBe(actionsOnly);
  });

  it("normalizes Prisma JSON float drift in metrics hashes", () => {
    const native = (23 / 42) * 100; // 54.761904761904766
    const drifted = 54.76190476190477; // observed Prisma JSON read-back
    expect(native).not.toBe(drifted);
    expect(normalizeJsonNumber(native)).toBe(normalizeJsonNumber(drifted));

    const base = {
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      summary: { issuesEvaluated: 1 } as never,
      labelPlans: [],
      evaluations: [],
    };
    expect(
      hashSprintAnalysisResult({
        ...base,
        metrics: { completedUnplannedPercent: native } as never,
      }),
    ).toBe(
      hashSprintAnalysisResult({
        ...base,
        metrics: { completedUnplannedPercent: drifted } as never,
      }),
    );
  });

  it("hashes Date and ISO string timestamps the same", () => {
    const iso = "2026-07-15T04:59:08.026Z";
    const base = {
      milestone,
      managedLabels: DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
      metrics: { plannedCount: 1 } as never,
      summary: { issuesEvaluated: 1 } as never,
      labelPlans: [],
    };
    const evaluation = {
      projectId: 1,
      issueId: 10,
      issueIid: 1,
      planningStatus: "Planned",
      deliveryStatus: "Committed",
      workTypes: ["bug"],
      excludedFromCommitment: false,
      completedWithinSprint: true,
      existingLabels: [],
      labelsToAdd: ["sprint::planned"],
      managedLabelsToRemove: [],
      reasonCodes: [],
      closedAt: null,
    };
    expect(toIsoTimestamp(iso)).toBe(iso);
    expect(toIsoTimestamp(new Date(iso))).toBe(iso);
    expect(
      hashSprintAnalysisResult({
        ...base,
        evaluations: [{ ...evaluation, assignmentTimestamp: new Date(iso) } as never],
      }),
    ).toBe(
      hashSprintAnalysisResult({
        ...base,
        evaluations: [{ ...evaluation, assignmentTimestamp: iso } as never],
      }),
    );
  });
});
