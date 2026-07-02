import { describe, expect, it } from "vitest";

import { detectWorkItemGaps } from "@/server/services/gitlab/project-hygiene";

describe("project hygiene gaps", () => {
  it("flags missing weight on open issues", () => {
    const gaps = detectWorkItemGaps({
      type: "ISSUE",
      priority: "HIGH",
      storyPoints: null,
      assigneeId: "user-1",
      milestoneTitle: "Backlog",
      labels: ["Type::Task", "Feature::Page", "priority::high"],
      dueDate: new Date("2026-08-01"),
    });

    expect(gaps).toContain("missing_weight");
    expect(gaps).not.toContain("missing_assignee");
  });

  it("flags missing feature and priority labels", () => {
    const gaps = detectWorkItemGaps({
      type: "ISSUE",
      priority: "MEDIUM",
      storyPoints: 3,
      assigneeId: "user-1",
      milestoneTitle: "Backlog",
      labels: ["Type::Task"],
      dueDate: null,
    });

    expect(gaps).toContain("missing_feature_label");
    expect(gaps).toContain("missing_priority_label");
  });
});
