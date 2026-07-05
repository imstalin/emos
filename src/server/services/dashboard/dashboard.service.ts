import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";

import { partitionProductBacklog } from "@/domain/backlog/classify-product-backlog";
import { buildDayOnePlanningSummary } from "@/domain/sprint/planning-capacity";
import type {
  DashboardMetrics,
  ReleaseHealth,
  TeamMemberSummary,
} from "@/domain/types/dashboard";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  computeMemberWorkload,
  computeTeamWorkloadTotals,
} from "@/domain/workload/compute-workload";
import {
  buildActiveWorkWhere,
  buildDeliveryWorkloadWhere,
} from "@/domain/workload/delivery-work";
import {
  buildMonitoredProjectWhere,
  getMonitoredProjectDbIds,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

import {
  dashboardWorkItemInclude,
  loadActiveSprintRecord,
  loadActiveSprintWorkItems,
  mapDashboardWorkItem,
} from "./dashboard-shared";
import { getDemoDashboardMetrics } from "./demo-data";
import { buildSprintHealth } from "./sprint-metrics";

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
    const activeFilter = buildActiveWorkWhere(monitoredWhere);
    const workloadFilter = buildDeliveryWorkloadWhere(monitoredWhere);

    const [members, workItems, activeSprint] = await Promise.all([
      db.teamMember.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          capacity: true,
        },
      }),
      db.workItem.findMany({
        where: activeFilter,
        include: dashboardWorkItemInclude,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      }),
      loadActiveSprintRecord(),
    ]);

    const sprintWorkItemRows = activeSprint
      ? await loadActiveSprintWorkItems(activeSprint, { openOnly: true })
      : [];
    const sprintWorkItems = sprintWorkItemRows.map(mapDashboardWorkItem);

    const releases = await db.release.findMany({
      where: {
        releasedAt: null,
        ...(monitoredDbIds ? { projectId: { in: monitoredDbIds } } : {}),
      },
      include: { project: true },
      orderBy: { targetDate: "asc" },
      take: 5,
    });

    const memberWorkloadRows = await db.teamMember.findMany({
      where: { isActive: true },
      include: {
        workItems: {
          where: workloadFilter,
        },
      },
    });

    const workload: TeamMemberSummary[] = memberWorkloadRows.map((member) => {
      const metrics = computeMemberWorkload(
        member.workItems,
        member.capacity,
        member.role,
      );

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        capacity: member.capacity,
        assignedPoints: metrics.assignedPoints,
        activeItems: metrics.activeItems,
        utilizationPercent: metrics.utilizationPercent,
        isOverloaded: metrics.isOverloaded,
        loadBasis: metrics.loadBasis,
        wipLimit: metrics.wipLimit,
        health: computeOverallHealth(member.workItems),
        lastActivityAt: member.workItems.reduce<string | null>((latest, item) => {
          const activity = item.lastActivityAt?.toISOString() ?? null;
          if (!activity) return latest;
          if (!latest) return activity;
          return activity > latest ? activity : latest;
        }, null),
      };
    });

    const teamCapacity = computeTeamWorkloadTotals(workload);
    const dayOne = buildDayOnePlanningSummary(
      members,
      sprintWorkItems.length,
      sprintWorkItems.filter((item) => item.qaOwnerName).length,
    );

    const sprintHealth = await buildSprintHealth(
      activeSprint,
      monitoredWhere,
      members,
    );

    const mappedItems = workItems.map(mapDashboardWorkItem);

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

        return {
          id: release.id,
          version: release.version,
          name: release.name,
          projectName: release.project.name,
          targetDate: release.targetDate?.toISOString() ?? null,
          openItems: items.length,
          blockedItems: blocked.length,
          health: computeOverallHealth(items),
          progressPercent: 0,
        };
      }),
    );

    const sprintScopedIds = new Set(sprintWorkItems.map((item) => item.id));
    const qaItems = sprintWorkItems.length
      ? sprintWorkItems.filter(
          (w) => w.state === "QA" || w.labels.some((l) => l.toLowerCase() === "qa"),
        )
      : mappedItems.filter(
          (w) => w.state === "QA" || w.labels.some((l) => l.toLowerCase() === "qa"),
        );

    const openItems = mappedItems.filter(
      (w) => w.state !== "DONE" && w.state !== "CLOSED",
    );
    const productBacklog = partitionProductBacklog(openItems);

    const pendingReviews = sprintWorkItems.length
      ? sprintWorkItems.filter((w) => w.state === "IN_REVIEW")
      : mappedItems.filter((w) => w.state === "IN_REVIEW");

    return {
      generatedAt: new Date().toISOString(),
      teamStatus: {
        totalMembers: members.length,
        activeMembers: workload.filter((m) => m.activeItems > 0).length,
        developers: members.filter((m) => m.role === "DEVELOPER").length,
        qaMembers: members.filter((m) => m.role === "QA").length,
        overallHealth: computeOverallHealth(workItems),
      },
      currentWork: sprintWorkItems.length
        ? sprintWorkItems.filter(
            (w) => w.state === "IN_PROGRESS" || w.state === "OPEN",
          )
        : mappedItems.filter(
            (w) => w.state === "IN_PROGRESS" || w.state === "OPEN",
          ),
      blockers: mappedItems.filter((w) => w.state === "BLOCKED"),
      highPriority: (sprintWorkItems.length ? sprintWorkItems : mappedItems).filter(
        (w) => w.priority === "CRITICAL" || w.priority === "HIGH",
      ),
      releaseHealth,
      sprintHealth,
      pendingReviews,
      qaStatus: {
        inQa: qaItems.filter((w) => w.state === "QA").length,
        awaitingQa: pendingReviews.length,
        failedQa: qaItems.filter((w) => w.health === "CRITICAL").length,
        items: qaItems,
      },
      productionIssues: mappedItems.filter((w) =>
        w.labels.some((l) => l.toLowerCase() === "production"),
      ),
      productBacklog,
      workload,
      teamCapacity,
      dayOne,
      sprintWorkItems,
    };
  }
}

export const dashboardService = new DashboardService();
