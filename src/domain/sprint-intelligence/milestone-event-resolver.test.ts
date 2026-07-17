import { describe, expect, it } from "vitest";

import {
  orderMilestoneEvents,
  resolveMilestoneAssignment,
} from "./milestone-event-resolver";
import { addEvent, ist, SPRINT } from "./test-helpers";

describe("orderMilestoneEvents", () => {
  it("orders out-of-chronology events by createdAt then id", () => {
    const ordered = orderMilestoneEvents([
      addEvent({ id: 3, action: "remove", createdAt: ist("2026-07-10") }),
      addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
      addEvent({ id: 2, action: "add", createdAt: ist("2026-07-12") }),
    ]);

    expect(ordered.map((event) => event.id)).toEqual([1, 3, 2]);
  });
});

describe("resolveMilestoneAssignment", () => {
  it("returns unavailable when events are null", () => {
    const result = resolveMilestoneAssignment({
      targetMilestoneId: SPRINT.id,
      currentMilestoneId: SPRINT.id,
      events: null,
    });
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reasonCode).toBe("MILESTONE_HISTORY_UNAVAILABLE");
    }
  });

  it("returns unavailable when no events for target milestone", () => {
    const result = resolveMilestoneAssignment({
      targetMilestoneId: SPRINT.id,
      currentMilestoneId: SPRINT.id,
      events: [
        addEvent({
          id: 1,
          action: "add",
          createdAt: ist("2026-07-05"),
          milestoneId: 999,
        }),
      ],
    });
    expect(result.kind).toBe("unavailable");
  });

  it("uses latest add after remove/reassign cycles", () => {
    const result = resolveMilestoneAssignment({
      targetMilestoneId: SPRINT.id,
      currentMilestoneId: SPRINT.id,
      events: [
        addEvent({ id: 1, action: "add", createdAt: ist("2026-07-01") }),
        addEvent({ id: 2, action: "remove", createdAt: ist("2026-07-03") }),
        addEvent({ id: 3, action: "add", createdAt: ist("2026-07-08", "15:00:00.000") }),
      ],
    });

    expect(result.kind).toBe("active");
    if (result.kind !== "active") return;
    expect(result.cycle.assignedAt.toISOString()).toBe(
      new Date(ist("2026-07-08", "15:00:00.000")).toISOString(),
    );
    expect(result.cycle.wasReassigned).toBe(true);
    expect(result.cycle.removedAt).toBeNull();
  });

  it("marks inactive when removed without reassignment", () => {
    const result = resolveMilestoneAssignment({
      targetMilestoneId: SPRINT.id,
      currentMilestoneId: 200,
      events: [
        addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        addEvent({ id: 2, action: "remove", createdAt: ist("2026-07-09") }),
      ],
    });

    expect(result.kind).toBe("inactive");
    if (result.kind !== "inactive") return;
    expect(result.reasonCode).toBe("MILESTONE_REMOVED_WITHOUT_REASSIGNMENT");
    expect(result.cycle?.removedAt).not.toBeNull();
  });

  it("handles events supplied out of order for multiple cycles", () => {
    const result = resolveMilestoneAssignment({
      targetMilestoneId: SPRINT.id,
      currentMilestoneId: SPRINT.id,
      events: [
        addEvent({ id: 4, action: "add", createdAt: ist("2026-07-11") }),
        addEvent({ id: 2, action: "remove", createdAt: ist("2026-07-07") }),
        addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        addEvent({
          id: 3,
          action: "add",
          createdAt: ist("2026-07-05"),
          milestoneId: 50,
        }),
      ],
    });

    expect(result.kind).toBe("active");
    if (result.kind !== "active") return;
    expect(result.cycle.wasReassigned).toBe(true);
    expect(result.cycle.assignedAt.toISOString()).toBe(
      new Date(ist("2026-07-11")).toISOString(),
    );
  });
});
