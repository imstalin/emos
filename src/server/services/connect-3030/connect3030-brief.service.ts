import { endOfMonth, format, startOfMonth } from "date-fns";

import type { WorkItemState } from "@prisma/client";

import type { Connect3030AutoBrief } from "@/domain/types/connect-3030";
import { monthLabelFromKey } from "@/domain/types/connect-3030";
import { db } from "@/lib/db";
import {
  MEMBER_KPI_DEFINITIONS,
  computeMetricById,
  computeUtilization,
  monthRange,
  type WorkItemRecord,
} from "@/server/services/kpi/phoenix-kpi-metrics";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

const DELIVERED: WorkItemState[] = ["CLOSED", "DONE"];
const ACTIVE: WorkItemState[] = [
  "OPEN",
  "IN_PROGRESS",
  "IN_REVIEW",
  "QA",
  "BLOCKED",
];

function activityAt(item: { lastActivityAt: Date | null; updatedAt: Date }) {
  return item.lastActivityAt ?? item.updatedAt;
}

export async function buildConnect3030Brief(
  memberId: string,
  monthKey: string,
): Promise<Connect3030AutoBrief> {
  const member = await db.teamMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      role: true,
      capacity: true,
    },
  });

  if (!member) {
    throw new Error("Team member not found");
  }

  const monthDate = new Date(`${monthKey}-01`);
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const monthColumn = { key: monthKey, label: monthLabelFromKey(monthKey), endDate: end.toISOString() };
  const { start: rangeStart, end: rangeEnd } = monthRange(monthColumn);

  const monitoredWhere = await buildMonitoredProjectWhere();
  const items = (await db.workItem.findMany({
    where: mergeWorkItemWhere({ assigneeId: memberId }, monitoredWhere),
    select: {
      id: true,
      type: true,
      state: true,
      labels: true,
      storyPoints: true,
      dueDate: true,
      lastActivityAt: true,
      updatedAt: true,
      createdAt: true,
      assigneeId: true,
      reviewerId: true,
      title: true,
      priority: true,
    },
  })) as Array<
    WorkItemRecord & { title: string; priority: string }
  >;

  const allItems = (await db.workItem.findMany({
    where: mergeWorkItemWhere({}, monitoredWhere),
    select: {
      id: true,
      type: true,
      state: true,
      labels: true,
      storyPoints: true,
      dueDate: true,
      lastActivityAt: true,
      updatedAt: true,
      createdAt: true,
      assigneeId: true,
      reviewerId: true,
    },
  })) as WorkItemRecord[];

  const kpiHighlights = MEMBER_KPI_DEFINITIONS.map((definition) => {
    const result = computeMetricById(
      definition.id,
      allItems,
      rangeStart,
      rangeEnd,
      memberId,
      member.capacity,
    );
    return {
      kpi: definition.kpi,
      score: result?.score ?? null,
      evidence: result?.evidence ?? null,
    };
  }).filter((row) => row.score !== null);

  const utilization = computeUtilization(
    allItems,
    rangeStart,
    rangeEnd,
    memberId,
    member.capacity,
  );

  const itemsClosed = items.filter(
    (item) =>
      DELIVERED.includes(item.state) &&
      activityAt(item) >= start &&
      activityAt(item) <= end,
  ).length;

  const itemsInProgress = items.filter((item) =>
    ACTIVE.includes(item.state),
  ).length;

  const blockedCount = items.filter((item) => item.state === "BLOCKED").length;

  const reviewsDone = allItems.filter(
    (item) =>
      item.type === "MERGE_REQUEST" &&
      item.reviewerId === memberId &&
      DELIVERED.includes(item.state) &&
      activityAt(item) >= start &&
      activityAt(item) <= end,
  ).length;

  const storyPointsClosed = items
    .filter(
      (item) =>
        item.type === "ISSUE" &&
        DELIVERED.includes(item.state) &&
        activityAt(item) >= start &&
        activityAt(item) <= end,
    )
    .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);

  const followUpItems = items
    .filter((item) => item.state === "BLOCKED" || item.priority === "CRITICAL")
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      reason:
        item.state === "BLOCKED"
          ? "Blocked work item needs manager support"
          : "Critical priority item open",
      priority: item.priority,
    }));

  const talkingPoints: string[] = [];

  if (kpiHighlights.length > 0) {
    const top = kpiHighlights[0];
    talkingPoints.push(
      `Review ${top.kpi} (${top.score}%) and agree on what drove the result.`,
    );
  }

  if (blockedCount > 0) {
    talkingPoints.push(
      `${blockedCount} blocked item(s) — identify unblockers and owners.`,
    );
  }

  if (utilization.score !== null && utilization.score < 65) {
    talkingPoints.push(
      `Utilization at ${utilization.score}% — discuss capacity, priorities, or leave.`,
    );
  } else if (utilization.score !== null && utilization.score > 90) {
    talkingPoints.push(
      `High utilization (${utilization.score}%) — check for overload and sustainable pace.`,
    );
  }

  if (itemsClosed > 0) {
    talkingPoints.push(
      `Celebrate ${itemsClosed} closed item(s) (${storyPointsClosed} story points).`,
    );
  }

  if (reviewsDone > 0) {
    talkingPoints.push(`Acknowledge ${reviewsDone} merge request review(s) this month.`);
  }

  talkingPoints.push("Confirm goals for the next 30 days and how you will support them.");

  const suggestedGoals: string[] = [];

  if (blockedCount > 0) {
    suggestedGoals.push(`Resolve or escalate ${blockedCount} blocked item(s) within 2 weeks.`);
  }

  if (utilization.score !== null && utilization.score < 65) {
    suggestedGoals.push("Increase focused delivery hours on top-priority backlog items.");
  }

  const scheduleRow = kpiHighlights.find((row) =>
    row.kpi.toLowerCase().includes("schedule"),
  );
  if (scheduleRow?.score != null && scheduleRow.score < 90) {
    suggestedGoals.push("Improve schedule adherence on committed due dates.");
  }

  if (suggestedGoals.length === 0) {
    suggestedGoals.push("Deliver planned sprint commitments with clear acceptance criteria.");
    suggestedGoals.push("Share one improvement idea for team or product process.");
  }

  return {
    generatedAt: new Date().toISOString(),
    monthKey,
    monthLabel: format(monthDate, "MMMM yyyy"),
    memberName: member.name,
    performance: {
      kpiHighlights,
      utilizationPercent: utilization.score,
      itemsClosed,
      itemsInProgress,
      blockedCount,
      reviewsDone,
      storyPointsClosed,
    },
    talkingPoints,
    suggestedGoals,
    followUpItems,
  };
}
