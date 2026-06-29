import { describe, expect, it } from "vitest";

import { getDemoTimesheetsReport } from "@/server/services/timesheets/timesheets-demo-data";

describe("getDemoTimesheetsReport", () => {
  it("returns a report with members and inferred hours", () => {
    const report = getDemoTimesheetsReport(0);

    expect(report.members.length).toBeGreaterThan(0);
    expect(report.totalInferredHours).toBeGreaterThan(0);
    expect(report.weekOffset).toBe(0);
    expect(report.membersWithActivity).toBeGreaterThan(0);
  });

  it("includes entry details per active member", () => {
    const report = getDemoTimesheetsReport(0);
    const active = report.members.find((member) => member.entryCount > 0);

    expect(active).toBeDefined();
    expect(active!.entries[0]).toMatchObject({
      title: expect.any(String),
      inferredHours: expect.any(Number),
      activityType: "assigned",
    });
  });
});
