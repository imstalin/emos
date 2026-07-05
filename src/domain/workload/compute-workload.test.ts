import { describe, expect, it } from "vitest";

import {
  computeMemberWorkload,
  computeTeamWorkloadTotals,
} from "@/domain/workload/compute-workload";

describe("computeMemberWorkload", () => {
  it("uses active item counts when story points are missing", () => {
    const result = computeMemberWorkload(
      Array.from({ length: 10 }, () => ({ storyPoints: null })),
      40,
    );

    expect(result.loadBasis).toBe("active_items");
    expect(result.activeItems).toBe(10);
    expect(result.utilizationPercent).toBe(100);
    expect(result.isOverloaded).toBe(true);
    expect(result.wipLimit).toBe(8);
  });

  it("uses story points when enough items are estimated", () => {
    const result = computeMemberWorkload(
      [
        { storyPoints: 5 },
        { storyPoints: 8 },
        { storyPoints: 3 },
      ],
      40,
    );

    expect(result.loadBasis).toBe("story_points");
    expect(result.assignedPoints).toBe(16);
    expect(result.utilizationPercent).toBe(40);
    expect(result.isOverloaded).toBe(false);
  });
});

describe("computeTeamWorkloadTotals", () => {
  it("aggregates item-based team utilization", () => {
    const totals = computeTeamWorkloadTotals([
      {
        capacity: 40,
        activeItems: 10,
        assignedPoints: 0,
        loadBasis: "active_items",
        isOverloaded: true,
      },
      {
        capacity: 40,
        activeItems: 4,
        assignedPoints: 0,
        loadBasis: "active_items",
        isOverloaded: false,
      },
    ]);

    expect(totals.loadBasis).toBe("active_items");
    expect(totals.allocatedItems).toBe(14);
    expect(totals.totalWipLimit).toBe(16);
    expect(totals.utilizationPercent).toBe(88);
    expect(totals.membersOverCapacity).toBe(1);
  });
});
