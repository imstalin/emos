import { describe, expect, it } from "vitest";

import {
  classifyProductBacklog,
  getScopedTypeLabel,
  isBacklogMilestone,
  isDefectTypeLabel,
  partitionProductBacklog,
} from "@/domain/backlog/classify-product-backlog";

describe("classifyProductBacklog", () => {
  it("detects scoped type labels", () => {
    expect(getScopedTypeLabel(["Type::Defect", "priority::high"])).toBe("defect");
    expect(getScopedTypeLabel(["Type::Task"])).toBe("task");
  });

  it("classifies backlog milestone tasks vs defects", () => {
    expect(
      classifyProductBacklog("Backlog", ["Type::Task", "priority::high"]),
    ).toBe("task");
    expect(
      classifyProductBacklog("Backlog", ["Type::Defect", "priority::high"]),
    ).toBe("defect");
    expect(
      classifyProductBacklog("Backlog", ["Type::Change Request"]),
    ).toBe("task");
    expect(classifyProductBacklog("Sprint 42", ["Type::Defect"])).toBeNull();
  });

  it("matches milestone case-insensitively", () => {
    expect(isBacklogMilestone("backlog")).toBe(true);
    expect(isDefectTypeLabel(["Type::Defect"])).toBe(true);
  });

  it("partitions work item summaries", () => {
    const items = [
      {
        id: "1",
        milestoneTitle: "Backlog",
        labels: ["Type::Task"],
      },
      {
        id: "2",
        milestoneTitle: "Backlog",
        labels: ["Type::Defect"],
      },
      {
        id: "3",
        milestoneTitle: "Done",
        labels: ["Type::Task"],
      },
    ];

    const { tasks, defects } = partitionProductBacklog(items);
    expect(tasks.map((item) => item.id)).toEqual(["1"]);
    expect(defects.map((item) => item.id)).toEqual(["2"]);
  });
});
