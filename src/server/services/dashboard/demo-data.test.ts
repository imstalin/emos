import { describe, expect, it } from "vitest";

import { getDemoDashboardMetrics } from "@/server/services/dashboard/demo-data";

describe("getDemoDashboardMetrics", () => {
  it("returns all required dashboard sections", () => {
    const metrics = getDemoDashboardMetrics();

    expect(metrics.teamStatus.totalMembers).toBeGreaterThan(0);
    expect(metrics.currentWork.length).toBeGreaterThan(0);
    expect(metrics.blockers.length).toBeGreaterThan(0);
    expect(metrics.highPriority.length).toBeGreaterThan(0);
    expect(metrics.releaseHealth.length).toBeGreaterThan(0);
    expect(metrics.sprintHealth).not.toBeNull();
    expect(metrics.workload.length).toBe(8);
    expect(metrics.teamCapacity.utilizationPercent).toBeGreaterThan(0);
  });

  it("includes production issues with production label", () => {
    const metrics = getDemoDashboardMetrics();
    expect(metrics.productionIssues.every((item) =>
      item.labels.includes("production"),
    )).toBe(true);
  });
});
