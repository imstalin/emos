import type {
  HealthStatus,
  Priority,
  WorkItemState,
} from "@prisma/client";

import type { GitLabIssue, GitLabMergeRequest } from "@/domain/types/gitlab";

function hasLabel(labels: string[], patterns: string[]): boolean {
  const normalized = labels.map((label) => label.toLowerCase());
  return patterns.some((pattern) =>
    normalized.some(
      (label) => label.includes(pattern) || label === pattern,
    ),
  );
}

export function mapIssueState(
  issue: Pick<GitLabIssue, "state" | "labels" | "assignee">,
): WorkItemState {
  if (issue.state === "closed") return "CLOSED";

  if (hasLabel(issue.labels, ["blocked", "blocker"])) return "BLOCKED";
  if (hasLabel(issue.labels, ["qa", "testing", "test"])) return "QA";
  if (hasLabel(issue.labels, ["review", "in review"])) return "IN_REVIEW";
  if (issue.assignee) return "IN_PROGRESS";

  return "OPEN";
}

export function mapMergeRequestState(
  mr: Pick<GitLabMergeRequest, "state" | "draft" | "labels">,
): WorkItemState {
  if (mr.state === "merged") return "DONE";
  if (mr.state === "closed") return "CLOSED";
  if (mr.draft) return "OPEN";
  if (hasLabel(mr.labels, ["blocked", "blocker"])) return "BLOCKED";
  return "IN_REVIEW";
}

export function mapPriority(
  labels: string[],
  weight: number | null,
): Priority {
  if (
    hasLabel(labels, [
      "critical",
      "p1",
      "priority::1",
      "priority::blocker",
      "blocker",
      "productionpriority::p1",
    ])
  ) {
    return "CRITICAL";
  }
  if (hasLabel(labels, ["high", "p2", "priority::2", "productionpriority::p2"])) {
    return "HIGH";
  }
  if (hasLabel(labels, ["low", "p4", "priority::4", "productionpriority::p3"])) {
    return "LOW";
  }
  if (hasLabel(labels, ["priority::medium"])) {
    return "MEDIUM";
  }

  if (weight !== null) {
    if (weight >= 3) return "HIGH";
    if (weight === 2) return "MEDIUM";
    if (weight <= 1) return "LOW";
  }

  return "MEDIUM";
}

export function mapHealth(params: {
  state: WorkItemState;
  labels: string[];
  dueDate: Date | null;
  lastActivityAt: Date | null;
}): HealthStatus {
  const { state, labels, dueDate, lastActivityAt } = params;

  if (state === "CLOSED" || state === "DONE") return "HEALTHY";
  if (hasLabel(labels, ["blocked", "blocker"])) return "CRITICAL";
  if (dueDate && dueDate.getTime() < Date.now()) return "AT_RISK";

  if (lastActivityAt) {
    const inactiveDays =
      (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    if (inactiveDays >= 5) return "AT_RISK";
  }

  return "HEALTHY";
}

export function parseGitLabDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function slugifyPath(path: string): string {
  return path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
