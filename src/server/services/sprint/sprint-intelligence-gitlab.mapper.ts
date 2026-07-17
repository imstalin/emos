import type {
  ResourceMilestoneEvent,
  SprintIntelligenceIssueInput,
  SprintMilestoneInput,
} from "@/domain/types/sprint-intelligence";
import type { GitLabIssue } from "@/domain/types/gitlab";

import {
  normalizeEventsForTargetMilestone,
  resolveCurrentMilestoneId,
} from "./sprint-intelligence-milestone-match";

export function mapGitLabIssueToSprintInput(params: {
  issue: GitLabIssue;
  milestone: SprintMilestoneInput;
  milestoneEvents: ResourceMilestoneEvent[] | null;
  allowTitleOnlyMilestoneMatch?: boolean;
}): SprintIntelligenceIssueInput {
  const { issue, milestone, milestoneEvents, allowTitleOnlyMilestoneMatch } =
    params;

  return {
    projectId: issue.project_id,
    issueId: issue.id,
    issueIid: issue.iid,
    title: issue.title,
    state: issue.state,
    labels: [...issue.labels],
    assignees: (issue.assignees ?? []).map((assignee) => ({
      id: assignee.id,
      name: assignee.name,
      username: assignee.username,
    })),
    createdAt: issue.created_at,
    closedAt: issue.closed_at ?? null,
    currentMilestoneId: resolveCurrentMilestoneId(
      issue,
      milestone,
      allowTitleOnlyMilestoneMatch ?? false,
    ),
    milestoneEvents,
  };
}

export function mapProviderEventsToDomain(params: {
  events: Parameters<typeof normalizeEventsForTargetMilestone>[0];
  milestone: SprintMilestoneInput;
  allowTitleOnlyMilestoneMatch?: boolean;
}): {
  domainEvents: ResourceMilestoneEvent[];
  ambiguous: boolean;
} {
  const { events, ambiguous } = normalizeEventsForTargetMilestone(
    params.events,
    params.milestone,
    params.allowTitleOnlyMilestoneMatch ?? false,
  );

  return {
    domainEvents: events,
    ambiguous,
  };
}
