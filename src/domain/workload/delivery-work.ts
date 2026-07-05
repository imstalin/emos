import type { Prisma, WorkItemState } from "@prisma/client";

import { mergeWorkItemWhere } from "@/server/services/gitlab/monitored-projects";

export const BACKLOG_MILESTONE = "Backlog";
export const SPRINT_BACKLOG_MILESTONE = "Sprint Backlog";

export const DELIVERY_ACTIVE_STATES = [
  "IN_PROGRESS",
  "IN_REVIEW",
  "QA",
  "BLOCKED",
] as const satisfies WorkItemState[];

export type DeliveryActiveState = (typeof DELIVERY_ACTIVE_STATES)[number];

export function buildDeliveryWorkloadWhere(
  monitoredWhere: Prisma.WorkItemWhereInput,
): Prisma.WorkItemWhereInput {
  return mergeWorkItemWhere(
    {
      state: { in: [...DELIVERY_ACTIVE_STATES] },
      OR: [
        { milestoneTitle: null },
        { milestoneTitle: { not: BACKLOG_MILESTONE } },
      ],
    },
    monitoredWhere,
  );
}

export function buildActiveWorkWhere(
  monitoredWhere: Prisma.WorkItemWhereInput,
): Prisma.WorkItemWhereInput {
  return mergeWorkItemWhere(
    {
      state: { notIn: ["DONE", "CLOSED"] },
      OR: [
        { milestoneTitle: null },
        { milestoneTitle: { not: BACKLOG_MILESTONE } },
      ],
    },
    monitoredWhere,
  );
}

export function buildSprintScopeWhere(
  monitoredWhere: Prisma.WorkItemWhereInput,
): Prisma.WorkItemWhereInput {
  return mergeWorkItemWhere(
    {
      OR: [
        { milestoneTitle: SPRINT_BACKLOG_MILESTONE },
        {
          milestoneTitle: { contains: "Sprint", mode: "insensitive" },
        },
      ],
    },
    monitoredWhere,
  );
}
