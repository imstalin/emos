import { describe, expect, it } from "vitest";

import {
  responsesFromBrief,
  type Connect3030AutoBrief,
} from "@/domain/types/connect-3030";

describe("connect-3030 responses", () => {
  it("builds auto-filled manager responses from brief", () => {
    const brief: Connect3030AutoBrief = {
      generatedAt: new Date().toISOString(),
      monthKey: "2025-11",
      monthLabel: "November 2025",
      memberName: "Jawahar",
      performance: {
        kpiHighlights: [
          { kpi: "Schedule Adherence", score: 95, evidence: "19/20 on time" },
        ],
        utilizationPercent: 80,
        itemsClosed: 5,
        itemsInProgress: 3,
        blockedCount: 1,
        reviewsDone: 2,
        storyPointsClosed: 12,
      },
      talkingPoints: ["Review blocked items."],
      suggestedGoals: ["Clear blockers within 2 weeks."],
      followUpItems: [
        {
          title: "API timeout fix",
          reason: "Blocked work item",
          priority: "HIGH",
        },
      ],
    };

    const responses = responsesFromBrief(brief);
    expect(responses.performanceDiscussed).toContain("Schedule Adherence");
    expect(responses.goalsForNextPeriod).toContain("Clear blockers");
    expect(responses.actionItems.length).toBe(1);
  });
});
