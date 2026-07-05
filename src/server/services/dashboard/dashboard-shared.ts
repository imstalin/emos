import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";

import { classifyProductBacklog } from "@/domain/backlog/classify-product-backlog";
import type { WorkItemSummary } from "@/domain/types/dashboard";
import { db } from "@/lib/db";
import { buildMonitoredProjectWhere } from "@/server/services/gitlab/monitored-projects";

import { buildActiveSprintItemWhere, dashboardWorkItemInclude } from "./sprint-scope";

export { dashboardWorkItemInclude };

type WorkItemRow = {
  id: string;
  title: string;
  type: WorkItemSummary["type"];
  state: WorkItemState;
  priority: Priority;
  health: HealthStatus;
  dueDate: Date | null;
  labels: string[];
  webUrl: string | null;
  milestoneTitle: string | null;
  assignee: { name: string } | null;
  qaOwner: { name: string } | null;
  project: { name: string };
};

export function mapDashboardWorkItem(item: WorkItemRow): WorkItemSummary {
  const milestoneTitle = item.milestoneTitle ?? null;
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    state: item.state,
    priority: item.priority,
    health: item.health,
    assigneeName: item.assignee?.name ?? null,
    qaOwnerName: item.qaOwner?.name ?? null,
    projectName: item.project.name,
    dueDate: item.dueDate?.toISOString() ?? null,
    labels: item.labels,
    milestoneTitle,
    backlogCategory: classifyProductBacklog(milestoneTitle, item.labels),
    webUrl: item.webUrl,
  };
}

export async function loadActiveSprintRecord() {
  return db.sprint.findFirst({
    where: { isActive: true, gitlabMilestoneId: { not: null } },
    orderBy: { startDate: "asc" },
  });
}

export async function loadActiveSprintWorkItems(
  sprint: { id: string; name: string },
  options?: { openOnly?: boolean; take?: number },
) {
  const monitoredWhere = await buildMonitoredProjectWhere();
  const where = buildActiveSprintItemWhere(sprint, monitoredWhere);

  return db.workItem.findMany({
    where: options?.openOnly
      ? {
          AND: [
            where,
            { state: { notIn: ["DONE", "CLOSED"] as WorkItemState[] } },
          ],
        }
      : where,
    include: dashboardWorkItemInclude,
    orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
    ...(options?.take ? { take: options.take } : {}),
  });
}
