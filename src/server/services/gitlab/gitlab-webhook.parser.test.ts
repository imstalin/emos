import { describe, expect, it } from "vitest";

import { parseGitLabWebhookPayload } from "@/server/services/gitlab/gitlab-webhook.parser";

describe("parseGitLabWebhookPayload", () => {
  it("accepts issue events", () => {
    expect(
      parseGitLabWebhookPayload({
        object_kind: "issue",
        project: { id: 123 },
      }),
    ).toEqual({
      supported: true,
      gitlabProjectId: 123,
      objectKind: "issue",
    });
  });

  it("skips unsupported events", () => {
    expect(
      parseGitLabWebhookPayload({
        object_kind: "wiki_page",
        project: { id: 123 },
      }).supported,
    ).toBe(false);
  });
});
