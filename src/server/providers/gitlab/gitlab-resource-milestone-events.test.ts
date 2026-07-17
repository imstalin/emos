import { describe, expect, it, vi } from "vitest";

import { mapResourceMilestoneEvents } from "./gitlab-resource-milestone-events";

describe("mapResourceMilestoneEvents", () => {
  it("3. maps snake_case fields to provider model", () => {
    const mapped = mapResourceMilestoneEvents([
      {
        id: 11,
        action: "add",
        created_at: "2026-07-05T10:00:00.000Z",
        milestone: {
          id: 100,
          iid: 2,
          title: "Sprint 42",
          start_date: "2026-07-06",
          due_date: "2026-07-17",
        },
        user: { id: 7, username: "planner", name: "Planner" },
      },
    ]);

    expect(mapped).toEqual([
      {
        id: 11,
        action: "add",
        createdAt: "2026-07-05T10:00:00.000Z",
        milestone: {
          id: 100,
          iid: 2,
          title: "Sprint 42",
          startDate: "2026-07-06",
          dueDate: "2026-07-17",
        },
        user: { id: 7, username: "planner", name: "Planner" },
      },
    ]);
  });

  it("4. maps null milestone values", () => {
    const mapped = mapResourceMilestoneEvents([
      {
        id: 1,
        action: "remove",
        created_at: "2026-07-09T00:00:00.000Z",
        milestone: null,
      },
    ]);
    expect(mapped[0]?.milestone).toBeNull();
  });

  it("5. ignores unknown event actions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mapped = mapResourceMilestoneEvents([
      {
        id: 1,
        action: "add",
        created_at: "2026-07-05T00:00:00.000Z",
        milestone: { id: 1, title: "S" },
      },
      {
        id: 2,
        action: "mysterious_future_action",
        created_at: "2026-07-06T00:00:00.000Z",
        milestone: { id: 1, title: "S" },
      },
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.action).toBe("add");
    warn.mockRestore();
  });
});
