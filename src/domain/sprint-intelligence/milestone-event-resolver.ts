import type {
  MilestoneAssignmentCycle,
  MilestoneAssignmentResolution,
  ResourceMilestoneEvent,
} from "@/domain/types/sprint-intelligence";

import { toDate } from "./timezone";

function eventTime(event: ResourceMilestoneEvent): number {
  return toDate(event.createdAt).getTime();
}

/**
 * Order events chronologically (stable by id when timestamps tie).
 */
export function orderMilestoneEvents(
  events: ResourceMilestoneEvent[],
): ResourceMilestoneEvent[] {
  return [...events].sort((a, b) => {
    const delta = eventTime(a) - eventTime(b);
    if (delta !== 0) return delta;
    return a.id - b.id;
  });
}

/**
 * Resolve the latest assignment cycle for the target milestone from
 * GitLab resource milestone events.
 *
 * Does not use issue created_at / updated_at.
 */
export function resolveMilestoneAssignment(params: {
  targetMilestoneId: number;
  currentMilestoneId: number | null;
  events: ResourceMilestoneEvent[] | null;
}): MilestoneAssignmentResolution {
  const { targetMilestoneId, currentMilestoneId, events } = params;

  if (events == null) {
    return {
      kind: "unavailable",
      reasonCode: "MILESTONE_HISTORY_UNAVAILABLE",
    };
  }

  const ordered = orderMilestoneEvents(events);
  const relevant = ordered.filter(
    (event) => event.milestoneId === targetMilestoneId,
  );

  if (relevant.length === 0) {
    return {
      kind: "unavailable",
      reasonCode: "MILESTONE_HISTORY_UNAVAILABLE",
    };
  }

  type CycleDraft = {
    assignedAt: Date;
    removedAt: Date | null;
    assignedByUserId: number | null;
    assignedByUserName: string | null;
  };

  const cycles: CycleDraft[] = [];
  let open: CycleDraft | null = null;

  for (const event of relevant) {
    // Unknown actions are ignored (filtered at the GitLab mapper; defensive here).
    if (event.action === "add") {
      if (open && open.removedAt == null) {
        // Consecutive add without remove — treat as a new cycle start.
        open.removedAt = toDate(event.createdAt);
        cycles.push(open);
      }
      open = {
        assignedAt: toDate(event.createdAt),
        removedAt: null,
        assignedByUserId: event.userId ?? null,
        assignedByUserName: event.userName ?? null,
      };
    } else if (event.action === "remove") {
      if (open && open.removedAt == null) {
        open.removedAt = toDate(event.createdAt);
        cycles.push(open);
        open = null;
      }
    }
  }

  if (open) {
    cycles.push(open);
  }

  if (cycles.length === 0) {
    return {
      kind: "unavailable",
      reasonCode: "MILESTONE_HISTORY_UNAVAILABLE",
    };
  }

  const latest = cycles[cycles.length - 1]!;
  const wasReassigned = cycles.length > 1;
  const cycle: MilestoneAssignmentCycle = {
    milestoneId: targetMilestoneId,
    assignedAt: latest.assignedAt,
    removedAt: latest.removedAt,
    assignedByUserId: latest.assignedByUserId,
    assignedByUserName: latest.assignedByUserName,
    wasReassigned,
    orderedEvents: relevant,
  };

  const currentlyOnTarget = currentMilestoneId === targetMilestoneId;
  const activelyAssigned = currentlyOnTarget && latest.removedAt == null;

  if (activelyAssigned) {
    return { kind: "active", cycle };
  }

  if (!currentlyOnTarget) {
    return {
      kind: "inactive",
      cycle,
      reasonCode:
        latest.removedAt != null
          ? "MILESTONE_REMOVED_WITHOUT_REASSIGNMENT"
          : "NOT_ON_TARGET_MILESTONE",
    };
  }

  // Currently on target — prefer active even if event stream is incomplete.
  return { kind: "active", cycle };
}
