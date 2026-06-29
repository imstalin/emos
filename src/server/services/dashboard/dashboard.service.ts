import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";

import {
  classifyProductBacklog,
  partitionProductBacklog,
} from "@/domain/backlog/classify-product-backlog";
import type {
  DashboardMetrics,
  ReleaseHealth,
  SprintHealth,
  TeamMemberSummary,
  WorkItemSummary,
} from "@/domain/types/dashboard";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDemoDashboardMetrics } from "@/server/services/dashboard/demo-data";
import {
  buildMonitoredProjectWhere,
  getMonitoredProjectDbIds,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

function mapWorkItem(item: {
  id: string;
  title: string;
  type: WorkItemSummary["type"];
  state: WorkItemState;
  priority: Priority;
  health: HealthStatus;
  dueDate: Date | null;
  labels: string[];
  webUrl: string | null;
  milestoneTitle?: string | null;
  assignee: { name: string } | null;
  project: { name: string };
}): WorkItemSummary {
  const milestoneTitle = item.milestoneTitle ?? null;
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    state: item.state,
    priority: item.priority,
    health: item.health,
    assigneeName: item.assignee?.name ?? null,
    projectName: item.project.name,
    dueDate: item.dueDate?.toISOString() ?? null,
    labels: item.labels,
    milestoneTitle,
    backlogCategory: classifyProductBacklog(milestoneTitle, item.labels),
    webUrl: item.webUrl,
  };
}

function computeOverallHealth(
  items: { health: HealthStatus }[],
): HealthStatus {
  if (items.some((i) => i.health === "CRITICAL")) return "CRITICAL";
  if (items.some((i) => i.health === "AT_RISK")) return "AT_RISK";
  if (items.length > 0) return "HEALTHY";
  return "UNKNOWN";
}

export class DashboardService {
  async getMetrics(): Promise<DashboardMetrics> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo dashboard data — database unavailable");
      return getDemoDashboardMetrics();
    }

    try {
      const workItemCount = await db.workItem.count();
      if (workItemCount === 0) {
        logger.info("Database empty — using demo dashboard data");
        return getDemoDashboardMetrics();
      }

      return await this.buildMetricsFromDatabase();
    } catch (error) {
      logger.error("Failed to load dashboard metrics", { error });
      return getDemoDashboardMetrics();
    }
  }

  private async buildMetricsFromDatabase(): Promise<DashboardMetrics> {
    const monitoredWhere = await buildMonitoredProjectWhere();
    const monitoredDbIds = await getMonitoredProjectDbIds();
    const activeFilter = mergeWorkItemWhere(
      { state: { notIn: ["DONE", "CLOSED"] } },
      monitoredWhere,
    );

    const [
      members,
      workItems,
      activeSprint,
      releases,
    ] = await Promise.all([
      db.teamMember.findMany({
        where: { isActive: true },
        include: {
          workItems: {
            where: activeFilter,
          },
        },
      }),
      db.workItem.findMany({
        where: activeFilter,
        include: {
          assignee: true,
          project: true,
        },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      }),
      db.sprint.findFirst({
        where: { isActive: true },
        include: { workItems: true },
      }),
      db.release.findMany({
        where: {
          releasedAt: null,
          ...(monitoredDbIds ? { projectId: { in: monitoredDbIds } } : {}),
        },
        include: {
          project: true,
        },
        orderBy: { targetDate: "asc" },
        take: 5,
      }),
    ]);

    const mappedItems = workItems.map(mapWorkItem);

    const workload: TeamMemberSummary[] = members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      capacity: member.capacity,
      assignedPoints: member.workItems.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      ),
      activeItems: member.workItems.length,
      health: computeOverallHealth(member.workItems),
      lastActivityAt: member.workItems.reduce<string | null>((latest, item) => {
        const activity = item.lastActivityAt?.toISOString() ?? null;
        if (!activity) return latest;
        if (!latest) return activity;
        return activity > latest ? activity : latest;
      }, null),
    }));

    const totalCapacity = workload.reduce((sum, m) => sum + m.capacity, 0);
    const allocatedPoints = workload.reduce(
      (sum, m) => sum + m.assignedPoints,
      0,
    );

    let sprintHealth: SprintHealth | null = null;
    if (activeSprint) {
      const completed = activeSprint.workItems.filter(
        (w) => w.state === "DONE",
      );
      const totalPoints = activeSprint.workItems.reduce(
        (sum, w) => sum + (w.storyPoints ?? 0),
        0,
      );
      const completedPoints = completed.reduce(
        (sum, w) => sum + (w.storyPoints ?? 0),
        0,
      );
      const endDate = activeSprint.endDate;
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      );

      sprintHealth = {
        id: activeSprint.id,
        name: activeSprint.name,
        goal: activeSprint.goal,
        startDate: activeSprint.startDate.toISOString(),
        endDate: endDate.toISOString(),
        completedPoints,
        totalPoints,
        velocity: completedPoints,
        health: computeOverallHealth(activeSprint.workItems),
        daysRemaining,
      };
    }

    const releaseHealth: ReleaseHealth[] = await Promise.all(
      releases.map(async (release) => {
        const items = await db.workItem.findMany({
          where: mergeWorkItemWhere(
            {
              projectId: release.projectId,
              state: { notIn: ["DONE", "CLOSED"] },
            },
            monitoredWhere,
          ),
        });
        const blocked = items.filter((i) => i.state === "BLOCKED");
        const total = items.length + blocked.length;
        const done = total - items.length;

        return {
          id: release.id,
          version: release.version,
          name: release.name,
          projectName: release.project.name,
          targetDate: release.targetDate?.toISOString() ?? null,
          openItems: items.length,
          blockedItems: blocked.length,
          health: computeOverallHealth(items),
          progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      }),
    );

    const qaItems = mappedItems.filter(
      (w) => w.state === "QA" || w.labels.some((l) => l.toLowerCase() === "qa"),
    );

    const openItems = mappedItems.filter(
      (w) => w.state !== "DONE" && w.state !== "CLOSED",
    );
    const productBacklog = partitionProductBacklog(openItems);

    return {
      generatedAt: new Date().toISOString(),
      teamStatus: {
        totalMembers: members.length,
        activeMembers: workload.filter((m) => m.activeItems > 0).length,
        developers: members.filter((m) => m.role === "DEVELOPER").length,
        qaMembers: members.filter((m) => m.role === "QA").length,
        overallHealth: computeOverallHealth(workItems),
      },
      currentWork: mappedItems.filter(
        (w) => w.state === "IN_PROGRESS" || w.state === "OPEN",
      ),
      blockers: mappedItems.filter((w) => w.state === "BLOCKED"),
      highPriority: mappedItems.filter(
        (w) => w.priority === "CRITICAL" || w.priority === "HIGH",
      ),
      releaseHealth,
      sprintHealth,
      pendingReviews: mappedItems.filter((w) => w.state === "IN_REVIEW"),
      qaStatus: {
        inQa: qaItems.filter((w) => w.state === "QA").length,
        awaitingQa: mappedItems.filter((w) => w.state === "IN_REVIEW").length,
        failedQa: qaItems.filter((w) => w.health === "CRITICAL").length,
        items: qaItems,
      },
      productionIssues: mappedItems.filter((w) =>
        w.labels.some((l) => l.toLowerCase() === "production"),
      ),
      productBacklog,
      workload,
      teamCapacity: {
        totalCapacity,
        allocatedPoints,
        utilizationPercent:
          totalCapacity > 0
            ? Math.round((allocatedPoints / totalCapacity) * 100)
            : 0,
        membersOverCapacity: workload.filter(
          (m) => m.assignedPoints > m.capacity * 0.5,
        ).length,
      },
    };
  }
}

export const dashboardService = new DashboardService();
