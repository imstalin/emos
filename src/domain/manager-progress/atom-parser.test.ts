import { describe, expect, it } from "vitest";

import {
  classifyEventType,
  normalizeAtomEntry,
  parseGitLabAtomFeed,
  redactFeedUrl,
} from "@/domain/manager-progress/atom-parser";

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:gitlab.com,2024:merge-request-1108</id>
    <title>Approved merge request !1108 in phoenix/business</title>
    <updated>2024-08-10T10:52:00Z</updated>
    <link rel="alternate" href="https://gitlab.example.com/phoenix/business/-/merge_requests/1108"/>
    <content type="html">Approved merge request !1108</content>
  </entry>
  <entry>
    <id>tag:gitlab.com,2024:merge-request-1108-merged</id>
    <title>Merged merge request !1108 in phoenix/business</title>
    <updated>2024-08-10T11:00:00Z</updated>
    <link rel="alternate" href="https://gitlab.example.com/phoenix/business/-/merge_requests/1108"/>
    <content type="html">Merged merge request !1108</content>
  </entry>
  <entry>
    <id>tag:gitlab.com,2024:issue-comment</id>
    <title>Commented on issue #123</title>
    <updated>2024-08-10T14:00:00Z</updated>
    <link rel="alternate" href="https://gitlab.example.com/phoenix/admin/-/issues/123"/>
    <content type="html">PPRD validation cannot proceed because tenant is unavailable</content>
  </entry>
</feed>`;

describe("parseGitLabAtomFeed", () => {
  it("parses MR approved and merged events", () => {
    const activities = parseGitLabAtomFeed(SAMPLE_ATOM);
    expect(activities).toHaveLength(3);
    expect(activities[0].eventType).toBe("merge_request_approved");
    expect(activities[0].mrNumber).toBe(1108);
    expect(activities[1].eventType).toBe("merge_request_merged");
  });

  it("parses issue comment with environment blocker language", () => {
    const activities = parseGitLabAtomFeed(SAMPLE_ATOM);
    expect(activities[2].eventType).toBe("issue_commented");
    expect(activities[2].issueNumber).toBe(123);
  });

  it("deduplicates by gitlab event id on re-parse", () => {
    const first = parseGitLabAtomFeed(SAMPLE_ATOM);
    const second = parseGitLabAtomFeed(SAMPLE_ATOM);
    expect(first.map((a) => a.gitlabEventId)).toEqual(
      second.map((a) => a.gitlabEventId),
    );
  });
});

describe("classifyEventType", () => {
  it("classifies branch and push events", () => {
    expect(classifyEventType("Pushed to branch feature/TSC-123", "")).toBe(
      "push_to_branch",
    );
    expect(classifyEventType("Created branch feature/TSC-123", "")).toBe(
      "branch_created",
    );
    expect(classifyEventType("Deleted branch feature/old", "")).toBe(
      "branch_deleted",
    );
  });

  it("classifies MR lifecycle events", () => {
    expect(classifyEventType("Opened merge request !286", "")).toBe(
      "merge_request_opened",
    );
    expect(classifyEventType("Approved merge request !195", "")).toBe(
      "merge_request_approved",
    );
    expect(classifyEventType("Merged merge request !1108", "")).toBe(
      "merge_request_merged",
    );
    expect(classifyEventType("Closed merge request !99", "")).toBe(
      "merge_request_closed",
    );
  });

  it("classifies issue events", () => {
    expect(classifyEventType("Closed issue #55", "")).toBe("issue_closed");
    expect(classifyEventType("Opened issue #12", "")).toBe("issue_opened");
  });
});

describe("normalizeAtomEntry", () => {
  it("returns null without entry id", () => {
    expect(normalizeAtomEntry({ title: "Test" })).toBeNull();
  });
});

describe("redactFeedUrl", () => {
  it("removes feed_token from logged URLs", () => {
    const redacted = redactFeedUrl(
      "https://gitlab.example.com/User.atom?feed_token=secret-token",
    );
    expect(redacted).not.toContain("secret-token");
    expect(redacted).toContain("User.atom");
  });
});
