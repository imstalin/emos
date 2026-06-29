import { endOfMonth, startOfMonth } from "date-fns";

import type { WorkItemState, WorkItemType } from "@prisma/client";

import type { PhoenixMonthColumn } from "@/domain/types/phoenix-kpi";

export const DELIVERED_STATES: WorkItemState[] = ["CLOSED", "DONE"];
export const TTM_TARGET_DAYS = 90;
export const REVIEW_HOURS = 1;
export const HOURS_PER_POINT = 4;
export const DEFAULT_ISSUE_HOURS = 2;
export const DEFAULT_MR_HOURS = 3;
export const WEEKS_PER_MONTH = 4;

export type WorkItemRecord = {
  id: string;
  type: WorkItemType;
  state: WorkItemState;
  labels: string[];
  storyPoints: number | null;
  dueDate: Date | null;
  lastActivityAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  assigneeId: string | null;
  reviewerId: string | null;
};

export interface MetricResult {
  score: number | null;
  evidence: string;
}

export function hasDefectLabel(labels: string[]): boolean {
  return labels.some((label) => /^type::defect$/i.test(label));
}

export function hasAcceptanceLabel(labels: string[]): boolean {
  return labels.some(
    (label) =>
      /^type::acceptance$/i.test(label) ||
      /^type::task$/i.test(label) ||
      /^type::story$/i.test(label),
  );
}

export function activityAt(item: WorkItemRecord): Date {
  return item.lastActivityAt ?? item.updatedAt;
}

export function isInMonth(date: Date, monthStart: Date, monthEnd: Date): boolean {
  return date >= monthStart && date <= monthEnd;
}

export function inferHours(item: WorkItemRecord, asReviewer = false): number {
  if (asReviewer) return REVIEW_HOURS;
  if (item.storyPoints != null) return item.storyPoints * HOURS_PER_POINT;
  return item.type === "MERGE_REQUEST" ? DEFAULT_MR_HOURS : DEFAULT_ISSUE_HOURS;
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return roundScore((numerator / denominator) * 100);
}

export function monthRange(month: PhoenixMonthColumn): {
  key: string;
  start: Date;
  end: Date;
} {
  const start = startOfMonth(new Date(month.endDate));
  return { key: month.key, start, end: endOfMonth(start) };
}

export function filterDeliveredStories(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): WorkItemRecord[] {
  return items.filter(
    (item) =>
      item.type === "ISSUE" &&
      DELIVERED_STATES.includes(item.state) &&
      !hasDefectLabel(item.labels) &&
      isInMonth(activityAt(item), start, end) &&
      (memberId === undefined || item.assigneeId === memberId),
  );
}

export function filterActiveIssues(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): WorkItemRecord[] {
  return items.filter(
    (item) =>
      item.type === "ISSUE" &&
      isInMonth(activityAt(item), start, end) &&
      (memberId === undefined || item.assigneeId === memberId),
  );
}

export function filterClosedMergeRequests(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
  asReviewer = false,
): WorkItemRecord[] {
  return items.filter(
    (item) =>
      item.type === "MERGE_REQUEST" &&
      DELIVERED_STATES.includes(item.state) &&
      isInMonth(activityAt(item), start, end) &&
      (memberId === undefined
        ? true
        : asReviewer
          ? item.reviewerId === memberId
          : item.assigneeId === memberId),
  );
}

export function filterDefectsClosed(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): WorkItemRecord[] {
  return items.filter(
    (item) =>
      item.type === "ISSUE" &&
      DELIVERED_STATES.includes(item.state) &&
      hasDefectLabel(item.labels) &&
      isInMonth(activityAt(item), start, end) &&
      (memberId === undefined || item.assigneeId === memberId),
  );
}

export function computeScheduleAdherence(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): MetricResult {
  const delivered = filterDeliveredStories(items, start, end, memberId);
  const numerator = delivered.filter(
    (item) => !item.dueDate || activityAt(item) <= item.dueDate,
  ).length;
  const denominator = delivered.length;
  return {
    score: pct(numerator, denominator),
    evidence: `${numerator}/${denominator} stories closed on or before due date`,
  };
}

export function computeEffortAdherence(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): MetricResult {
  const withPoints = filterDeliveredStories(items, start, end, memberId).filter(
    (item) => item.storyPoints !== null,
  );
  const numerator = withPoints.filter(
    (item) => !item.dueDate || activityAt(item) <= item.dueDate,
  ).length;
  const denominator = withPoints.length;
  return {
    score: pct(numerator, denominator),
    evidence: `${numerator}/${denominator} estimated stories closed on schedule`,
  };
}

export function computeFirstTimeRight(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): MetricResult {
  const delivered = filterDeliveredStories(items, start, end, memberId);
  const defects = filterDefectsClosed(items, start, end, memberId);
  const denominator = delivered.length;
  const numerator = Math.max(0, denominator - defects.length);
  return {
    score: denominator > 0 ? pct(numerator, denominator) : null,
    evidence: `${numerator}/${denominator} deliveries without closed defects`,
  };
}

export function computeEffortThroughput(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): MetricResult {
  const deliveredPoints = filterDeliveredStories(items, start, end, memberId).reduce(
    (sum, item) => sum + (item.storyPoints ?? 1),
    0,
  );
  const plannedPoints = filterActiveIssues(items, start, end, memberId).reduce(
    (sum, item) => sum + (item.storyPoints ?? 1),
    0,
  );
  const score =
    plannedPoints > 0 ? roundScore((deliveredPoints / plannedPoints) * 100) : null;
  return {
    score,
    evidence: `${deliveredPoints} delivered pts / ${plannedPoints} active pts`,
  };
}

export function computeCodeReviewCompliance(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): MetricResult {
  if (memberId) {
    const reviewed = filterClosedMergeRequests(items, start, end, memberId, true);
    const authoredClosed = filterClosedMergeRequests(
      items,
      start,
      end,
      memberId,
      false,
    );
    const numerator = reviewed.length;
    const denominator = authoredClosed.length;
    return {
      score: denominator > 0 ? pct(numerator, denominator) : null,
      evidence: `${numerator} reviews / ${denominator} authored MRs closed`,
    };
  }

  const closed = filterClosedMergeRequests(items, start, end);
  const numerator = closed.filter((item) => item.reviewerId !== null).length;
  const denominator = closed.length;
  return {
    score: pct(numerator, denominator),
    evidence: `${numerator}/${denominator} MRs with reviewer recorded`,
  };
}

export function computeTimeToMarket(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
): MetricResult {
  const candidates = filterDeliveredStories(items, start, end, memberId).filter(
    (item) => hasAcceptanceLabel(item.labels) || !hasDefectLabel(item.labels),
  );
  const denominator = candidates.length;
  const numerator = candidates.filter((item) => {
    const days =
      (activityAt(item).getTime() - item.createdAt.getTime()) /
      (1000 * 60 * 60 * 24);
    return days <= TTM_TARGET_DAYS;
  }).length;
  return {
    score: pct(numerator, denominator),
    evidence: `${numerator}/${denominator} stories closed within ${TTM_TARGET_DAYS} days`,
  };
}

export function computeUtilization(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId: string,
  capacityWeekly: number,
): MetricResult {
  let projectHours = 0;
  for (const item of items) {
    const updated = activityAt(item);
    if (!isInMonth(updated, start, end)) continue;

    if (item.assigneeId === memberId) {
      projectHours += inferHours(item);
    }
    if (
      item.reviewerId === memberId &&
      item.reviewerId !== item.assigneeId
    ) {
      projectHours += REVIEW_HOURS;
    }
  }

  const capacityHours = capacityWeekly * WEEKS_PER_MONTH;
  const score =
    capacityHours > 0
      ? roundScore((projectHours / capacityHours) * 100)
      : null;
  return {
    score,
    evidence: `${roundScore(projectHours)} inferred hrs / ${capacityHours} capacity hrs`,
  };
}

export function computeTeamUtilization(
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  members: Array<{ id: string; capacity: number }>,
): MetricResult {
  let projectHours = 0;
  const memberIds = new Set(members.map((member) => member.id));

  for (const item of items) {
    const updated = activityAt(item);
    if (!isInMonth(updated, start, end)) continue;

    if (item.assigneeId && memberIds.has(item.assigneeId)) {
      projectHours += inferHours(item);
    }
    if (
      item.reviewerId &&
      memberIds.has(item.reviewerId) &&
      item.reviewerId !== item.assigneeId
    ) {
      projectHours += REVIEW_HOURS;
    }
  }

  const totalCapacityHours = members.reduce(
    (sum, member) => sum + member.capacity * WEEKS_PER_MONTH,
    0,
  );
  const score =
    totalCapacityHours > 0
      ? roundScore((projectHours / totalCapacityHours) * 100)
      : null;
  return {
    score,
    evidence: `${roundScore(projectHours)} inferred hrs / ${totalCapacityHours} capacity hrs`,
  };
}

export const MEMBER_KPI_DEFINITIONS = [
  {
    id: "schedule-adherence",
    category: "Project Delivery",
    kpi: "Schedule Adherence",
    matchers: ["schedule adherence"],
  },
  {
    id: "effort-adherence",
    category: "Project Delivery",
    kpi: "Effort Adherence",
    matchers: ["effort adherence"],
  },
  {
    id: "first-time-right",
    category: "Project Delivery",
    kpi: "First Time Right",
    matchers: ["first time right"],
  },
  {
    id: "effort-throughput",
    category: "Development Efficiency",
    kpi: "Effort Throughput",
    matchers: ["effort throughput"],
  },
  {
    id: "code-review",
    category: "Development Efficiency",
    kpi: "Code Review Compliance",
    matchers: ["code review"],
  },
  {
    id: "time-to-market",
    category: "Speed of development",
    kpi: "Time to market",
    matchers: ["time to market"],
  },
  {
    id: "utilization",
    category: "Utilization",
    kpi: "Utilization",
    matchers: ["utilization"],
  },
] as const;

export function computeMetricById(
  metricId: string,
  items: WorkItemRecord[],
  start: Date,
  end: Date,
  memberId?: string,
  capacityWeekly?: number,
): MetricResult | null {
  switch (metricId) {
    case "schedule-adherence":
      return computeScheduleAdherence(items, start, end, memberId);
    case "effort-adherence":
      return computeEffortAdherence(items, start, end, memberId);
    case "first-time-right":
      return computeFirstTimeRight(items, start, end, memberId);
    case "effort-throughput":
      return computeEffortThroughput(items, start, end, memberId);
    case "code-review":
      return computeCodeReviewCompliance(items, start, end, memberId);
    case "time-to-market":
      return computeTimeToMarket(items, start, end, memberId);
    case "utilization":
      if (!memberId || capacityWeekly === undefined) return null;
      return computeUtilization(items, start, end, memberId, capacityWeekly);
    default:
      return null;
  }
}
