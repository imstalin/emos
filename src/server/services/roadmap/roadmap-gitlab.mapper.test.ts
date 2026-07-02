import { describe, expect, it } from "vitest";

import type { RoadmapItem } from "@/domain/types/roadmap";
import {
  buildGitLabLabels,
  hoursToGitLabWeight,
  resolveGitLabAssignee,
} from "@/server/services/roadmap/roadmap-gitlab.mapper";

const sampleItem: RoadmapItem = {
  id: "roadmap-1",
  priority: "High",
  include: "Yes",
  project: "CS 2.0 Core",
  category: "New Feature",
  quarter: "Q1",
  timeline: "Q1 FY27",
  assignee: "MJ",
  hours: 40,
  core: true,
  mobile: false,
  data: false,
  title: "Sample roadmap item",
  description: "Sample description",
};

describe("roadmap-gitlab.mapper", () => {
  it("maps roadmap fields to project 6100 labels", () => {
    const labels = buildGitLabLabels(sampleItem);
    expect(labels).toContain("priority::high");
    expect(labels).toContain("Type::Story");
    expect(labels).toContain("Change Type::New Feature");
    expect(labels).toContain("Feature::CommandEngine");
    expect(labels).toContain("plan::fy27");
  });

  it("converts hours to GitLab weight", () => {
    expect(hoursToGitLabWeight(40)).toBe(8);
    expect(hoursToGitLabWeight("TBD")).toBeNull();
  });

  it("resolves assignee initials", () => {
    const member = resolveGitLabAssignee("MJ", [
      { id: 1, username: "mjayapal", name: "Muruganandham Jayapal" },
    ]);
    expect(member?.username).toBe("mjayapal");
  });
});
