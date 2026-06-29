import { describe, expect, it } from "vitest";

import { evaluateGovernanceRule } from "@/server/services/governance/governance.rules";

describe("evaluateGovernanceRule", () => {
  it("flags issues without estimates", () => {
    expect(
      evaluateGovernanceRule("missing-estimate", {
        type: "ISSUE",
        priority: "MEDIUM",
        storyPoints: null,
        labels: [],
        dueDate: null,
        lastActivityAt: null,
        reviewStatus: null,
      }),
    ).toBe(true);
  });

  it("flags high priority items without due dates", () => {
    expect(
      evaluateGovernanceRule("missing-due-date", {
        type: "ISSUE",
        priority: "HIGH",
        storyPoints: 3,
        labels: [],
        dueDate: null,
        lastActivityAt: new Date(),
        reviewStatus: null,
      }),
    ).toBe(true);
  });

  it("flags oversized stories", () => {
    expect(
      evaluateGovernanceRule(
        "oversized-story",
        {
          type: "ISSUE",
          priority: "MEDIUM",
          storyPoints: 13,
          labels: [],
          dueDate: null,
          lastActivityAt: new Date(),
          reviewStatus: null,
        },
        { maxStoryPoints: 8 },
      ),
    ).toBe(true);
  });
});
