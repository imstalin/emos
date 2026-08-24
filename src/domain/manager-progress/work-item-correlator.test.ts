import { describe, expect, it } from "vitest";

import {
  correlationKeyForGrouping,
  deriveCorrelationKey,
  extractExternalReferences,
} from "@/domain/manager-progress/work-item-correlator";
import type { NormalizedFeedActivity } from "@/domain/types/manager-progress";

function activity(
  partial: Partial<NormalizedFeedActivity> & { title: string },
): NormalizedFeedActivity {
  return {
    gitlabEventId: "id-1",
    eventType: "merge_request_merged",
    description: null,
    url: null,
    project: null,
    repository: null,
    branch: null,
    commitSha: null,
    mrNumber: null,
    issueNumber: null,
    pipelineId: null,
    environment: null,
    timestamp: new Date(),
    rawPayload: {},
    ...partial,
  };
}

describe("work-item correlator", () => {
  it("groups issue, branch, MR and commits by ticket id", () => {
    const branchActivity = activity({
      title: "Pushed to branch feature/TSC-123",
      branch: "feature/TSC-123",
    });
    const mrActivity = activity({
      title: "Merged merge request !1108 for TSC-123",
      mrNumber: 1108,
    });
    const issueActivity = activity({
      title: "Commented on issue #123 — TSC-123 delivery fix",
      issueNumber: 123,
    });

    const branchSignal = deriveCorrelationKey(branchActivity);
    const mrSignal = deriveCorrelationKey(mrActivity);
    const issueSignal = deriveCorrelationKey(issueActivity);

    expect(branchSignal.externalReference).toBe("TSC-123");
    expect(mrSignal.externalReference).toBe("TSC-123");
    expect(issueSignal.externalReference).toBe("TSC-123");
    expect(correlationKeyForGrouping(branchSignal)).toBe("TSC-123");
    expect(correlationKeyForGrouping(mrSignal)).toBe("TSC-123");
  });

  it("keeps unrelated activities separate", () => {
    const a = deriveCorrelationKey(
      activity({ title: "Merged merge request !1 in alpha/project" }),
    );
    const b = deriveCorrelationKey(
      activity({ title: "Merged merge request !2 in beta/project" }),
    );
    expect(correlationKeyForGrouping(a)).not.toBe(correlationKeyForGrouping(b));
  });

  it("assigns confidence levels", () => {
    const medium = deriveCorrelationKey(
      activity({
        title: "Merged changes for TSC-456",
      }),
    );
    expect(medium.confidence).toBe("MEDIUM");

    const high = deriveCorrelationKey(
      activity({
        title: "Merged MR !1108",
        mrNumber: 1108,
        branch: "feature/TSC-123",
      }),
    );
    expect(high.confidence).toBe("HIGH");
  });

  it("extracts ticket references from text", () => {
    expect(extractExternalReferences("Fix TSC-123 and ABC-9")).toEqual([
      "TSC-123",
      "ABC-9",
    ]);
  });
});
