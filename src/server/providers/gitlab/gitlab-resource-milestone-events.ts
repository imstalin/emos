import type {
  GitLabResourceMilestoneEvent,
  GitLabResourceMilestoneEventRaw,
} from "@/domain/types/gitlab";
import { logger } from "@/lib/logger";

/**
 * Map raw GitLab resource milestone events to provider models.
 * Unknown actions are logged and dropped (never treated as assignments).
 */
export function mapResourceMilestoneEvents(
  rawEvents: GitLabResourceMilestoneEventRaw[],
): GitLabResourceMilestoneEvent[] {
  const mapped: GitLabResourceMilestoneEvent[] = [];

  for (const raw of rawEvents) {
    if (raw.action !== "add" && raw.action !== "remove") {
      logger.warn("sprint-intelligence.gitlab.events.unknown-action", {
        eventId: raw.id,
        action: raw.action,
      });
      continue;
    }

    mapped.push({
      id: raw.id,
      action: raw.action,
      createdAt: raw.created_at,
      milestone: raw.milestone
        ? {
            id: raw.milestone.id,
            iid: raw.milestone.iid,
            title: raw.milestone.title ?? "",
            startDate: raw.milestone.start_date ?? null,
            dueDate: raw.milestone.due_date ?? null,
          }
        : null,
      user: raw.user
        ? {
            id: raw.user.id,
            username: raw.user.username,
            name: raw.user.name,
          }
        : null,
    });
  }

  return mapped;
}
