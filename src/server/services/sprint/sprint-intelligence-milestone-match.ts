import type { SprintMilestoneInput } from "@/domain/types/sprint-intelligence";
import type { GitLabIssue, GitLabResourceMilestoneEvent } from "@/domain/types/gitlab";

export type MilestoneMatchResult =
  | { ok: true; matchedBy: "id" | "title_and_dates" | "title_only" }
  | { ok: false; code: "TARGET_MILESTONE_NOT_FOUND" | "AMBIGUOUS_MILESTONE_MATCH" };

function datesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false;
  return left.trim() === right.trim();
}

export function milestoneMatchesTarget(
  candidate: {
    id: number;
    title: string;
    startDate?: string | null;
    dueDate?: string | null;
  },
  target: SprintMilestoneInput,
  allowTitleOnly = false,
): MilestoneMatchResult {
  if (candidate.id === target.id) {
    return { ok: true, matchedBy: "id" };
  }

  const titleMatch = candidate.title === target.title;
  const datesMatch =
    datesEqual(candidate.startDate, target.startDate) &&
    datesEqual(candidate.dueDate, target.dueDate);

  if (titleMatch && datesMatch) {
    return { ok: true, matchedBy: "title_and_dates" };
  }

  if (allowTitleOnly && titleMatch) {
    return { ok: true, matchedBy: "title_only" };
  }

  return { ok: false, code: "TARGET_MILESTONE_NOT_FOUND" };
}

export function issueBelongsToTargetMilestone(
  issue: GitLabIssue,
  target: SprintMilestoneInput,
  allowTitleOnly = false,
): boolean {
  if (!issue.milestone) return false;
  const match = milestoneMatchesTarget(
    {
      id: issue.milestone.id,
      title: issue.milestone.title,
      startDate: issue.milestone.start_date,
      dueDate: issue.milestone.due_date,
    },
    target,
    allowTitleOnly,
  );
  return match.ok;
}

/**
 * Normalize provider events for the domain resolver.
 * Events that match the target milestone are rewritten to use `target.id`
 * so group vs project milestone ID differences do not break assignment cycles.
 * Unrelated milestones keep their original IDs and are ignored by the resolver.
 */
export function normalizeEventsForTargetMilestone(
  events: GitLabResourceMilestoneEvent[],
  target: SprintMilestoneInput,
  allowTitleOnly = false,
): {
  events: Array<{
    id: number;
    createdAt: string;
    action: "add" | "remove";
    milestoneId: number;
    userId: number | null;
    userName: string | null;
  }>;
  ambiguous: boolean;
} {
  const normalized = [];
  const matchedIds = new Set<number>();

  for (const event of events) {
    if (!event.milestone) {
      continue;
    }

    const match = milestoneMatchesTarget(
      {
        id: event.milestone.id,
        title: event.milestone.title,
        startDate: event.milestone.startDate,
        dueDate: event.milestone.dueDate,
      },
      target,
      allowTitleOnly,
    );

    if (match.ok) {
      matchedIds.add(event.milestone.id);
      normalized.push({
        id: event.id,
        createdAt: event.createdAt,
        action: event.action,
        milestoneId: target.id,
        userId: event.user?.id ?? null,
        userName: event.user?.name ?? event.user?.username ?? null,
      });
    } else {
      normalized.push({
        id: event.id,
        createdAt: event.createdAt,
        action: event.action,
        milestoneId: event.milestone.id,
        userId: event.user?.id ?? null,
        userName: event.user?.name ?? event.user?.username ?? null,
      });
    }
  }

  // Multiple distinct source IDs matched the same target via weak rules.
  const ambiguous = matchedIds.size > 1 && !matchedIds.has(target.id);

  return { events: normalized, ambiguous };
}

export function resolveCurrentMilestoneId(
  issue: GitLabIssue,
  target: SprintMilestoneInput,
  allowTitleOnly = false,
): number | null {
  if (!issue.milestone) return null;
  if (
    issueBelongsToTargetMilestone(issue, target, allowTitleOnly)
  ) {
    return target.id;
  }
  return issue.milestone.id;
}
