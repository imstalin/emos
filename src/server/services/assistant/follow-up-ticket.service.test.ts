import { describe, expect, it } from "vitest";

import type { FollowUpTicketContext } from "@/domain/types/follow-up-ticket";
import { formatTicketContextForAssistant } from "@/server/services/assistant/follow-up-ticket.service";

describe("formatTicketContextForAssistant", () => {
  it("includes description and comments in assistant context", () => {
    const ticket: FollowUpTicketContext = {
      followUpId: "blocked-1",
      workItemId: "wi-1",
      title: "Fix login bug",
      type: "ISSUE",
      description: "Users cannot log in on mobile.",
      webUrl: "https://gitlab.example.com/issues/1",
      commentsSource: "gitlab",
      comments: [
        {
          id: 1,
          authorName: "Alice",
          authorUsername: "alice",
          body: "Still reproducing on iOS.",
          createdAt: "2026-06-28T10:00:00.000Z",
        },
      ],
    };

    const formatted = formatTicketContextForAssistant(ticket);

    expect(formatted).toContain("Users cannot log in on mobile.");
    expect(formatted).toContain("Alice");
    expect(formatted).toContain("Still reproducing on iOS.");
  });
});
