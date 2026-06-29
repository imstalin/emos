import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";

import type {
  SprintHealth,
  TeamMemberSummary,
  WorkItemSummary,
} from "@/domain/types/dashboard";
import type {
  TeamDashboardData,
  TeamMemberDetail,
} from "@/domain/types/team";
import { classifyProductBacklog } from "@/domain/backlog/classify-product-backlog";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDemoTeamDashboard } from "@/server/services/team/team-demo-data";
import {
  buildMonitoredProjectWhere,
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

function computeOverallHealth(items: { health: HealthStatus }[]): HealthStatus {
  if (items.some((item) => item.health === "CRITICAL")) return "CRITICAL";
  if (items.some((item) => item.health === "AT_RISK")) return "AT_RISK";
  if (items.length > 0) return "HEALTHY";
  return "UNKNOWN";
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
      state: WorkItemState;
      priority: Priority;
      health: HealthStatus;
      dueDate: Date | null;
      labels: string[];
      webUrl: string | null;
      storyPoints: number | null;
      lastActivityAt: Date | null;
      assignee: { name: string } | null;
      project: { name: string };
    }>;
    reviews: Array<{
      id: string;
      title: string;
      type: WorkItemSummary["type"];
      state: WorkItemState;
      priority: Priority;
      health: HealthStatus;
      dueDate: Date | null;
      labels: string[];
      webUrl: string | null;
      assignee: { name: string } | null;
      project: { name: string };
    }>;
  },
): TeamMemberDetail {
  const assignedItems = member.workItems.map(mapWorkItem);
  const reviewItems = member.reviews.map(mapWorkItem);
  const assignedPoints = member.workItems.reduce(
    (sum, item) => sum + (item.storyPoints ?? 0),
    0,
  );
  const utilizationPercent =
    member.capacity > 0
      ? Math.min(100, Math.round((assignedPoints / member.capacity) * 100))
      : 0;

  const lastActivityAt = member.workItems.reduce<string | null>((latest, item) => {
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
    assignedPoints,
    activeItems: member.workItems.length,
    health: computeOverallHealth(member.workItems),
    lastActivityAt,
    blockedCount: member.workItems.filter((item) => item.state === "BLOCKED").length,
    inReviewCount: member.workItems.filter((item) => item.state === "IN_REVIEW").length,
    inQaCount: member.workItems.filter((item) => item.state === "QA").length,
    mergeRequestCount: member.workItems.filter(
      (item) => item.type === "MERGE_REQUEST",
    ).length,
    issueCount: member.workItems.filter((item) => item.type === "ISSUE").length,
    utilizationPercent,
    assignedItems,
    reviewItems,
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
    const activeFilter = mergeWorkItemWhere(
      { state: { notIn: ["DONE", "CLOSED"] as WorkItemState[] } },
      monitoredWhere,
    );

    const [members, unassignedRows, activeSprint, unassignedCount] =
      await Promise.all([
        db.teamMember.findMany({
          where: { isActive: true },
          include: {
            workItems: {
              where: activeFilter,
              include: { project: true, assignee: true },
              orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
            },
            reviews: {
              where: activeFilter,
              include: { project: true, assignee: true },
              orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
              take: 10,
            },
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        db.workItem.findMany({
          where: mergeWorkItemWhere(
            { assigneeId: null, state: { notIn: ["DONE", "CLOSED"] } },
            monitoredWhere,
          ),
          include: { project: true, assignee: true },
          orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
          take: 25,
        }),
        db.sprint.findFirst({
          where: { isActive: true },
          include: { workItems: true },
        }),
        db.workItem.count({
          where: mergeWorkItemWhere(
            { assigneeId: null, state: { notIn: ["DONE", "CLOSED"] } },
            monitoredWhere,
          ),
        }),
      ]);

    const memberDetails = members.map(buildMemberDetail);

    const totalCapacity = memberDetails.reduce((sum, member) => sum + member.capacity, 0);
    const allocatedPoints = memberDetails.reduce(
      (sum, member) => sum + member.assignedPoints,
      0,
    );

    let sprint: SprintHealth | null = null;
    if (activeSprint) {
      const completed = activeSprint.workItems.filter((item) => item.state === "DONE");
      const totalPoints = activeSprint.workItems.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      );
      const completedPoints = completed.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      );
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (activeSprint.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      );

      sprint = {
        id: activeSprint.id,
        name: activeSprint.name,
        goal: activeSprint.goal,
        startDate: activeSprint.startDate.toISOString(),
        endDate: activeSprint.endDate.toISOString(),
        completedPoints,
        totalPoints,
        velocity: completedPoints,
        health: computeOverallHealth(activeSprint.workItems),
        daysRemaining,
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      sprint,
      teamCapacity: {
        totalCapacity,
        allocatedPoints,
        utilizationPercent:
          totalCapacity > 0
            ? Math.round((allocatedPoints / totalCapacity) * 100)
            : 0,
        membersOverCapacity: memberDetails.filter(
          (member) => member.assignedPoints > member.capacity * 0.5,
        ).length,
      },
      members: memberDetails,
      unassigned: {
        count: unassignedCount,
        items: unassignedRows.map(mapWorkItem),
      },
      filters: {
        developers: members.filter((member) => member.role === "DEVELOPER").length,
        qaMembers: members.filter((member) => member.role === "QA").length,
      },
    };
  }
}

export const teamDashboardService = new TeamDashboardService();
