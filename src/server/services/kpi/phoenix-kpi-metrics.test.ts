import { describe, expect, it } from "vitest";

import {
  computeScheduleAdherence,
  computeUtilization,
  pct,
} from "./phoenix-kpi-metrics";

describe("phoenix-kpi-metrics", () => {
  const start = new Date("2025-11-01");
  const end = new Date("2025-11-30T23:59:59");

  it("calculates schedule adherence for a member", () => {
    const memberId = "member-1";
    const items = [
      {
        id: "1",
        type: "ISSUE" as const,
        state: "CLOSED" as const,
        labels: ["Type::Task"],
        storyPoints: 3,
        dueDate: new Date("2025-11-25"),
        lastActivityAt: new Date("2025-11-20"),
        updatedAt: new Date("2025-11-20"),
        createdAt: new Date("2025-11-01"),
        assigneeId: memberId,
        reviewerId: null,
      },
      {
        id: "2",
        type: "ISSUE" as const,
        state: "CLOSED" as const,
        labels: ["Type::Task"],
        storyPoints: 2,
        dueDate: new Date("2025-11-10"),
        lastActivityAt: new Date("2025-11-15"),
        updatedAt: new Date("2025-11-15"),
        createdAt: new Date("2025-11-01"),
        assigneeId: memberId,
        reviewerId: null,
      },
    ];

    const result = computeScheduleAdherence(items, start, end, memberId);
    expect(result.score).toBe(pct(1, 2));
    expect(result.evidence).toContain("1/2");
  });

  it("calculates utilization for a member", () => {
    const memberId = "member-1";
    const items = [
      {
        id: "1",
        type: "ISSUE" as const,
        state: "IN_PROGRESS" as const,
        labels: [],
        storyPoints: 5,
        dueDate: null,
        lastActivityAt: new Date("2025-11-12"),
        updatedAt: new Date("2025-11-12"),
        createdAt: new Date("2025-11-01"),
        assigneeId: memberId,
        reviewerId: null,
      },
    ];

    const result = computeUtilization(items, start, end, memberId, 40);
    expect(result.score).toBe(12.5);
    expect(result.evidence).toContain("20 inferred hrs / 160 capacity hrs");
  });
});
