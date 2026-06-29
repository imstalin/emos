import { describe, expect, it } from "vitest";

import {
  mapHealth,
  mapIssueState,
  mapMergeRequestState,
  mapPriority,
  slugifyPath,
} from "@/server/services/gitlab/gitlab.mapper";

describe("mapIssueState", () => {
  it("maps closed issues to CLOSED", () => {
    expect(
      mapIssueState({ state: "closed", labels: [], assignee: null }),
    ).toBe("CLOSED");
  });

  it("maps blocked open issues to BLOCKED", () => {
    expect(
      mapIssueState({
        state: "opened",
        labels: ["blocked"],
        assignee: null,
      }),
    ).toBe("BLOCKED");
  });

  it("maps assigned open issues to IN_PROGRESS", () => {
    expect(
      mapIssueState({
        state: "opened",
        labels: [],
        assignee: { id: 1, username: "dev", name: "Dev" },
      }),
    ).toBe("IN_PROGRESS");
  });
});

describe("mapMergeRequestState", () => {
  it("maps merged MRs to DONE", () => {
    expect(
      mapMergeRequestState({ state: "merged", draft: false, labels: [] }),
    ).toBe("DONE");
  });

  it("maps open MRs to IN_REVIEW", () => {
    expect(
      mapMergeRequestState({ state: "opened", draft: false, labels: [] }),
    ).toBe("IN_REVIEW");
  });
});

describe("mapPriority", () => {
  it("detects critical labels", () => {
    expect(mapPriority(["Priority::Critical"], null)).toBe("CRITICAL");
  });

  it("uses weight as fallback", () => {
    expect(mapPriority([], 3)).toBe("HIGH");
  });
});

describe("mapHealth", () => {
  it("flags overdue items as AT_RISK", () => {
    expect(
      mapHealth({
        state: "IN_PROGRESS",
        labels: [],
        dueDate: new Date("2020-01-01"),
        lastActivityAt: new Date(),
      }),
    ).toBe("AT_RISK");
  });
});

describe("slugifyPath", () => {
  it("normalizes project paths", () => {
    expect(slugifyPath("Release_Observations")).toBe("release-observations");
  });
});
