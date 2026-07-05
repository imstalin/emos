import type { HealthStatus, WorkItemState } from "@prisma/client";

import { buildDayOnePlanningSummary } from "@/domain/sprint/planning-capacity";
import type {
  TeamMemberSummary,
  WorkItemSummary,
} from "@/domain/types/dashboard";
import type {
  TeamDashboardData,
  TeamMemberDetail,
} from "@/domain/types/team";
import {
  computeMemberWorkload,
  computeTeamWorkloadTotals,
} from "@/domain/workload/compute-workload";
import {
  buildActiveWorkWhere,
  buildDeliveryWorkloadWhere,
} from "@/domain/workload/delivery-work";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  dashboardWorkItemInclude,
  loadActiveSprintRecord,
  loadActiveSprintWorkItems,
  mapDashboardWorkItem,
} from "@/server/services/dashboard/dashboard-shared";
import { buildSprintHealth } from "@/server/services/dashboard/sprint-metrics";
import { getDemoTeamDashboard } from "@/server/services/team/team-demo-data";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

function computeOverallHealth(items: { health: HealthStatus }[]): HealthStatus {
  if (items.some((item) => item.health === "CRITICAL")) return "CRITICAL";
  if (items.some((item) => item.health === "AT_RISK")) return "AT_RISK";
  if (items.length > 0) return "HEALTHY";
  return "UNKNOWN";
}

function dedupeWorkItems<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildMemberDetail(
  member: {
    id: string;
    name: string;
    role: TeamMemberSummary["role"];
    capacity: number;
    gitlabHandle: string | null;
    workItems: Array<{
      id: string;
      title: string;
      type: WorkItemSummary["type"];
      state: WorkItemSummary["state"];
      priority: WorkItemSummary["priority"];
      health: HealthStatus;
      dueDate: Date | null;
      labels: string[];
      webUrl: string | null;
      milestoneTitle: string | null;
      storyPoints: number | null;
      lastActivityAt: Date | null;
      assignee: { name: string } | null;
      qaOwner: { name: string } | null;
      project: { name: string };
    }>;
    qaOwnedWorkItems: Array<{
      id: string;
      title: string;
      type: WorkItemSummary["type"];
      state: WorkItemSummary["state"];
      priority: WorkItemSummary["priority"];
      health: HealthStatus;
      dueDate: Date | null;
      labels: string[];
      webUrl: string | null;
      milestoneTitle: string | null;
      assignee: { name: string } | null;
      qaOwner: { name: string } | null;
      project: { name: string };
    }>;
    reviews: Array<{
      id: string;
      title: string;
      type: WorkItemSummary["type"];
      state: WorkItemSummary["state"];
      priority: WorkItemSummary["priority"];
      health: HealthStatus;
      dueDate: Date | null;
      labels: string[];
      webUrl: string | null;
      milestoneTitle: string | null;
      assignee: { name: string } | null;
      qaOwner: { name: string } | null;
      project: { name: string };
    }>;
  },
): TeamMemberDetail {
  const qaOwnedItems = member.qaOwnedWorkItems.map(mapDashboardWorkItem);
  const assignedItems = member.workItems.map(mapDashboardWorkItem);
  const reviewItems = member.reviews.map(mapDashboardWorkItem);

  const workloadSource =
    member.role === "QA"
      ? dedupeWorkItems([
          ...member.qaOwnedWorkItems,
          ...member.workItems.filter((item) => item.state === "QA"),
        ])
      : member.workItems;

  const workload = computeMemberWorkload(
    workloadSource,
    member.capacity,
    member.role,
  );

  const lastActivityAt = workloadSource.reduce<string | null>((latest, item) => {
    const activity = item.lastActivityAt?.toISOString() ?? null;
    if (!activity) return latest;
    if (!latest) return activity;
    return activity > latest ? activity : latest;
  }, null);

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    capacity: member.capacity,
    gitlabHandle: member.gitlabHandle,
    assignedPoints: workload.assignedPoints,
    activeItems: workload.activeItems,
    utilizationPercent: workload.utilizationPercent,
    isOverloaded: workload.isOverloaded,
    loadBasis: workload.loadBasis,
    wipLimit: workload.wipLimit,
    health: computeOverallHealth(workloadSource),
    lastActivityAt,
    blockedCount: workloadSource.filter((item) => item.state === "BLOCKED").length,
    inReviewCount: workloadSource.filter((item) => item.state === "IN_REVIEW").length,
    inQaCount: workloadSource.filter((item) => item.state === "QA").length,
    qaOwnedCount: qaOwnedItems.length,
    mergeRequestCount: member.workItems.filter(
      (item) => item.type === "MERGE_REQUEST",
    ).length,
    issueCount: member.workItems.filter((item) => item.type === "ISSUE").length,
    assignedItems,
    reviewItems,
    qaOwnedItems,
  };
}

export class TeamDashboardService {
  async getDashboard(): Promise<TeamDashboardData> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo team dashboard — database unavailable");
      return getDemoTeamDashboard();
    }

    try {
      const memberCount = await db.teamMember.count({ where: { isActive: true } });
      if (memberCount === 0) {
        return getDemoTeamDashboard();
      }

      return await this.buildFromDatabase();
    } catch (error) {
      logger.error("Failed to load team dashboard", { error });
      return getDemoTeamDashboard();
    }
  }

  private async buildFromDatabase(): Promise<TeamDashboardData> {
    const monitoredWhere = await buildMonitoredProjectWhere();
    const workloadFilter = buildDeliveryWorkloadWhere(monitoredWhere);
    const qaOwnedFilter = mergeWorkItemWhere(
      {
        state: { notIn: ["DONE", "CLOSED"] as WorkItemState[] },
        type: "ISSUE",
      },
      monitoredWhere,
    );
    const unassignedFilter = mergeWorkItemWhere(
      {
        assigneeId: null,
        state: { notIn: ["DONE", "CLOSED"] as WorkItemState[] },
        OR: [
          { milestoneTitle: null },
          { milestoneTitle: { not: "Backlog" } },
        ],
      },
      monitoredWhere,
    );
    const reviewFilter = buildActiveWorkWhere(monitoredWhere);

    const [members, unassignedRows, activeSprint, unassignedCount, planningMembers] =
      await Promise.all([
        db.teamMember.findMany({
          where: { isActive: true },
          include: {
            workItems: {
              where: workloadFilter,
              include: dashboardWorkItemInclude,
              orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
            },
            qaOwnedWorkItems: {
              where: qaOwnedFilter,
              include: dashboardWorkItemInclude,
              orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
            },
            reviews: {
              where: reviewFilter,
              include: dashboardWorkItemInclude,
              orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
              take: 10,
            },
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        db.workItem.findMany({
          where: unassignedFilter,
          include: dashboardWorkItemInclude,
          orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
          take: 25,
        }),
        loadActiveSprintRecord(),
        db.workItem.count({ where: unassignedFilter }),
        db.teamMember.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true, capacity: true },
        }),
      ]);

    const sprintWorkItemRows = activeSprint
      ? await loadActiveSprintWorkItems(activeSprint, { openOnly: true })
      : [];
    const sprintWorkItems = sprintWorkItemRows.map(mapDashboardWorkItem);
    const qaQueue = sprintWorkItems.filter((item) => item.state === "IN_REVIEW");

    const memberDetails = members.map(buildMemberDetail);
    const teamCapacity = computeTeamWorkloadTotals(memberDetails);
    const sprint = await buildSprintHealth(
      activeSprint,
      monitoredWhere,
      planningMembers,
    );
    const dayOne = buildDayOnePlanningSummary(
      planningMembers,
      sprintWorkItems.length,
      sprintWorkItems.filter((item) => item.qaOwnerName).length,
    );

    return {
      generatedAt: new Date().toISOString(),
      sprint,
      teamCapacity,
      members: memberDetails,
      unassigned: {
        count: unassignedCount,
        items: unassignedRows.map(mapDashboardWorkItem),
      },
      filters: {
        developers: members.filter((member) => member.role === "DEVELOPER").length,
        qaMembers: members.filter((member) => member.role === "QA").length,
      },
      dayOne,
      sprintWorkItems,
      qaQueue,
    };
  }
}

export const teamDashboardService = new TeamDashboardService();
