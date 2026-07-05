import type { Prisma } from "@prisma/client";

import { mergeWorkItemWhere } from "@/server/services/gitlab/monitored-projects";

export function buildActiveSprintItemWhere(
  sprint: { id: string; name: string },
  monitoredWhere: Prisma.WorkItemWhereInput,
): Prisma.WorkItemWhereInput {
  return mergeWorkItemWhere(
    {
      type: "ISSUE",
      OR: [
        { sprintId: sprint.id },
        { milestoneTitle: { equals: sprint.name, mode: "insensitive" } },
      ],
    },
    monitoredWhere,
  );
}

export const dashboardWorkItemInclude = {
  assignee: { select: { name: true } },
  qaOwner: { select: { name: true } },
  project: { select: { name: true } },
} as const;
