import { describe, expect, it, vi } from "vitest";

import { requestSprintApply } from "./sprint-intelligence-client";

describe("sprint intelligence client apply payload", () => {
  it("sends only sourceAnalysisRunId and confirm", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        runId: "apply-1",
        status: "PENDING",
        jobId: "job-1",
        reused: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestSprintApply({
      sourceAnalysisRunId: "analysis-1",
      confirm: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sprints/intelligence/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sourceAnalysisRunId: "analysis-1",
          confirm: true,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
