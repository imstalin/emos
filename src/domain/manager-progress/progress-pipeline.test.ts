import { describe, expect, it } from "vitest";

import { detectBlockersFromActivity } from "@/domain/manager-progress/blocker-detector";
import {
  inferStageFromEvent,
  isMeaningfulStageTransition,
} from "@/domain/manager-progress/lifecycle-engine";
import { determineMovement } from "@/domain/manager-progress/progress-detector";
import { evaluateAttentionRules } from "@/domain/manager-progress/attention-rules";
import { DEFAULT_THRESHOLDS } from "@/domain/types/manager-progress";

describe("lifecycle engine", () => {
  it("maps development to review to merged to qa ready", () => {
    expect(inferStageFromEvent("merge_request_opened", "development")).toBe(
      "code_review",
    );
    expect(inferStageFromEvent("merge_request_merged", "code_review")).toBe(
      "qa_ready",
    );
    expect(isMeaningfulStageTransition("code_review", "qa_ready", "merge_request_merged")).toBe(
      true,
    );
  });

  it("maps issue closure to completed", () => {
    expect(inferStageFromEvent("issue_closed", "qa")).toBe("completed");
  });
});

describe("progress detector", () => {
  it("marks meaningful progress on stage advancement", () => {
    expect(
      determineMovement("development", "code_review", "merge_request_opened", false),
    ).toBe("MEANINGFUL_PROGRESS");
  });

  it("marks active when no stage movement", () => {
    expect(
      determineMovement("development", "development", "push_to_branch", false),
    ).toBe("ACTIVE_NO_MOVEMENT");
  });

  it("marks blocked when blocker present", () => {
    expect(
      determineMovement("qa_ready", "qa_ready", "issue_commented", true),
    ).toBe("BLOCKED");
  });
});

describe("blocker detector", () => {
  it("detects waiting for review as possible blocker", () => {
    const blockers = detectBlockersFromActivity({
      gitlabEventId: "1",
      eventType: "merge_request_commented",
      title: "Waiting for review on MR !1108",
      description: null,
      url: null,
      project: null,
      repository: null,
      branch: null,
      commitSha: null,
      mrNumber: 1108,
      issueNumber: null,
      pipelineId: null,
      environment: null,
      timestamp: new Date(),
      rawPayload: {},
    });
    expect(blockers.some((b) => !b.isConfirmed)).toBe(true);
  });

  it("detects environment unavailable blocker", () => {
    const blockers = detectBlockersFromActivity({
      gitlabEventId: "2",
      eventType: "issue_commented",
      title: "Comment",
      description: "PPRD validation cannot proceed because tenant unavailable",
      url: null,
      project: null,
      repository: null,
      branch: null,
      commitSha: null,
      mrNumber: null,
      issueNumber: null,
      pipelineId: null,
      environment: "PPRD",
      timestamp: new Date(),
      rawPayload: {},
    });
    expect(blockers.length).toBeGreaterThan(0);
  });
});

describe("attention rules", () => {
  it("flags MR review waiting beyond threshold", () => {
    const hits = evaluateAttentionRules(
      {
        workItemId: "w1",
        priorityName: "TSC Production",
        priorityId: "p1",
        title: "TSC MR",
        stage: "code_review",
        progressToday: "active_no_movement",
        lastMeaningfulProgressAt: new Date(Date.now() - 3 * 86400000),
        targetDate: null,
        releaseDate: null,
        activeWipCount: 2,
        alignment: "ALIGNED",
        hasBlocker: false,
        ownerName: "Selvam",
      },
      DEFAULT_THRESHOLDS,
      [],
    );
    expect(hits.some((h) => h.ruleKey === "mr_review_waiting")).toBe(true);
  });
});
