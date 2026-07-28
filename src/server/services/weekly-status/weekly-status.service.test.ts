import { describe, expect, it } from "vitest";

import type { WeeklyStatusConfig } from "@/domain/types/weekly-status";

import {
  formatWeekEndingLabel,
  renderWeeklyStatusMarkdown,
  weeklyStatusOutputFilename,
} from "./weekly-status.service";

const sampleConfig: WeeklyStatusConfig = {
  recipientName: "Roshni",
  senderName: "Stalin",
  timezone: "Asia/Kolkata",
  intro: "Intro paragraph.",
  overallSummary: "Overall summary.",
  includeSprintIntelligence: true,
  additionalItems: ["Mobile demo is scheduled."],
  asks: ["Confirm UAT status."],
  workstreams: [
    {
      id: "cash-rewards-uat",
      name: "Cash Rewards & Wallet – UAT",
      owner: "Core",
      status: "In Progress",
      completedThisWeek: "UAT continued",
      currentProgress: "UAT in progress",
      risks: "Resource availability",
      targetDate: "25/07/2026",
      nextMilestone: "Complete UAT",
      remarks: "Confirm sign-off",
    },
  ],
};

describe("weekly-status.service", () => {
  it("formats week-ending labels in DD/MM/YYYY for Asia/Kolkata", () => {
    expect(
      formatWeekEndingLabel(new Date("2026-07-25T10:00:00.000Z"), "Asia/Kolkata"),
    ).toBe("25/07/2026");
  });

  it("builds deterministic output filenames", () => {
    expect(
      weeklyStatusOutputFilename(
        new Date("2026-07-25T10:00:00.000Z"),
        "Asia/Kolkata",
      ),
    ).toBe("weekly-status-2026-07-25.md");
  });

  it("renders workstream table and sprint appendix", () => {
    const markdown = renderWeeklyStatusMarkdown({
      config: sampleConfig,
      weekEndingDate: new Date("2026-07-25T10:00:00.000Z"),
      sprintIntelligence: {
        milestoneTitle: "Jul - Sprint 2",
        completedAt: "2026-07-25T14:30:16.988Z",
        issuesEvaluated: 47,
        plannedCount: 32,
        committedCount: 9,
        spilloverCount: 23,
        spilloverPercent: 71.875,
        unplannedCount: 15,
        unplannedWorkPercent: 31.9,
        completedUnplannedCount: 2,
        commitmentReliabilityPercent: 28.125,
        bugCount: 9,
        readout: "Elevated spillover.",
      },
    });

    expect(markdown).toContain("Hi Roshni,");
    expect(markdown).toContain("Completed This Week (25/07/2026)");
    expect(markdown).toContain("Cash Rewards & Wallet – UAT");
    expect(markdown).toContain("Jul - Sprint 2");
    expect(markdown).toContain("Commitment reliability");
    expect(markdown).toContain("~28%");
    expect(markdown).toContain("Confirm UAT status.");
    expect(markdown).toContain("Regards,\nStalin");
  });

  it("notes missing sprint intelligence when enabled but unavailable", () => {
    const markdown = renderWeeklyStatusMarkdown({
      config: sampleConfig,
      weekEndingDate: new Date("2026-07-25T10:00:00.000Z"),
      sprintIntelligence: null,
    });
    expect(markdown).toContain("Sprint Intelligence snapshot unavailable");
  });
});
