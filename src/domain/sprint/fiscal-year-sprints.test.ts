import { describe, expect, it } from "vitest";

import {
  buildFiscalYearSprintPlan,
  buildPhoenixBiweeklyFridaySprintPlan,
} from "@/domain/sprint/fiscal-year-sprints";

describe("buildFiscalYearSprintPlan", () => {
  it("builds contiguous two-week sprints for the fiscal year", () => {
    const plan = buildFiscalYearSprintPlan({
      startDate: "2026-07-26",
      endDate: "2027-06-27",
    });

    expect(plan.sprints.length).toBeGreaterThan(20);
    expect(plan.sprints[0]).toEqual({
      number: 1,
      title: "Sprint 1 (08-2026)",
      startDate: "2026-07-26",
      dueDate: "2026-08-08",
    });
    expect(plan.sprints[1]?.startDate).toBe("2026-08-09");
    expect(plan.sprints.at(-1)?.dueDate).toBe("2027-06-27");
    expect(plan.sprints.at(-1)?.number).toBe(24);
  });
});

describe("buildPhoenixBiweeklyFridaySprintPlan", () => {
  it("starts on Monday Jul 6 and ends each sprint on Friday", () => {
    const plan = buildPhoenixBiweeklyFridaySprintPlan({
      startDate: "2026-07-06",
      endDate: "2027-06-30",
    });

    expect(plan.sprints).toHaveLength(26);
    expect(plan.sprints[0]).toEqual({
      number: 1,
      title: "Jul - Sprint 1",
      startDate: "2026-07-06",
      dueDate: "2026-07-17",
    });
    expect(plan.sprints[1]?.startDate).toBe("2026-07-20");
    expect(plan.sprints.at(-1)).toEqual({
      number: 26,
      title: "Jun - Sprint 26",
      startDate: "2027-06-21",
      dueDate: "2027-06-25",
    });

    for (const sprint of plan.sprints) {
      const dueDay = new Date(`${sprint.dueDate}T00:00:00.000Z`).getUTCDay();
      expect(dueDay, sprint.title).toBe(5);
      const startDay = new Date(`${sprint.startDate}T00:00:00.000Z`).getUTCDay();
      expect(startDay, sprint.title).toBe(1);
    }
  });
});
