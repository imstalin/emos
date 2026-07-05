import { describe, expect, it } from "vitest";

import {
  buildDayOnePlanningSummary,
  recommendedDevSprintItems,
  wipLimitForPlanningRole,
} from "@/domain/sprint/planning-capacity";

describe("planning-capacity", () => {
  const members = [
    { id: "1", name: "Dev1", role: "DEVELOPER" as const, capacity: 40 },
    { id: "2", name: "Dev2", role: "DEVELOPER" as const, capacity: 40 },
    { id: "3", name: "QA1", role: "QA" as const, capacity: 40 },
  ];

  it("uses lower WIP limit for QA than dev at same capacity", () => {
    expect(wipLimitForPlanningRole(40, "DEVELOPER")).toBe(8);
    expect(wipLimitForPlanningRole(40, "QA")).toBe(5);
  });

  it("flags QA bottleneck when dev stories exceed QA pairing", () => {
    const summary = buildDayOnePlanningSummary(members, 12, 4);
    expect(summary.qaUnassignedInActiveSprint).toBe(8);
    expect(summary.sprintBalanced).toBe(false);
  });

  it("recommends sprint size limited by QA capacity", () => {
    const team = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `d${i}`,
        name: `Dev${i}`,
        role: "DEVELOPER" as const,
        capacity: 40,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `q${i}`,
        name: `QA${i}`,
        role: "QA" as const,
        capacity: 40,
      })),
    ];

    expect(recommendedDevSprintItems(team)).toBe(15);
  });
});
