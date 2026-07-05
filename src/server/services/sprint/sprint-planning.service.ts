import type { Priority, Prisma } from "@prisma/client";

import {
  buildDayOnePlanningSummary,
  recommendedDevSprintItems,
  type PlanningMember,
} from "@/domain/sprint/planning-capacity";
import type {
  SprintAssignmentResult,
  SprintPlanningBoard,
  SprintPlanningColumn,
  SprintPlanningItem,
  SprintPlanningMember,
  SprintQaOwnerResult,
} from "@/domain/types/sprint-planning";
import {
  computeTeamWorkloadTotals,
  shouldUseStoryPoints,
  type WorkloadBasis,
} from "@/domain/workload/compute-workload";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

const SPRINT_BACKLOG_MILESTONE = "Sprint Backlog";
const PLANNING_BACKLOG_MILESTONES = [SPRINT_BACKLOG_MILESTONE, "Backlog"] as const;

const PRIORITY_ORDER: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

type WorkItemRow = Prisma.WorkItemGetPayload<{
  include: {
    assignee: { select: { name: true } };
    qaOwner: { select: { name: true } };
    project: { select: { name: true; gitlabId: true } };
  };
}>;

function mapPlanningItem(item: WorkItemRow): SprintPlanningItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    state: item.state,
    priority: item.priority,
    assigneeId: item.assigneeId,
    assigneeName: item.assignee?.name ?? null,
    qaOwnerId: item.qaOwnerId,
    qaOwnerName: item.qaOwner?.name ?? null,
    projectName: item.project.name,
    storyPoints: item.storyPoints,
    milestoneTitle: item.milestoneTitle,
    webUrl: item.webUrl,
    gitlabIid: item.gitlabIid,
  };
}

function summarizeSprintItems(items: SprintPlanningItem[]): {
  plannedPoints: number;
  loadBasis: WorkloadBasis;
} {
  const plannedPoints = items.reduce(
    (sum, item) => sum + (item.storyPoints ?? 0),
    0,
  );
  const loadBasis: WorkloadBasis = shouldUseStoryPoints(items, plannedPoints)
    ? "story_points"
    : "active_items";

  return {
    plannedPoints:
      loadBasis === "story_points" ? plannedPoints : items.length,
    loadBasis,
  };
}

function sortForPlanning(items: SprintPlanningItem[]): SprintPlanningItem[] {
  return [...items].sort((a, b) => {
    const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    if (a.assigneeName && !b.assigneeName) return -1;
    if (!a.assigneeName && b.assigneeName) return 1;
    return a.title.localeCompare(b.title);
  });
}

async function resolveSprintBacklogMilestoneId(): Promise<number | null> {
  const config = getGitLabConfig();
  if (!config) return null;

  const provider = createGitLabProvider(config);
  const milestones = await provider.listGroupMilestones(
    Number(config.groupId),
    "active",
  );
  const backlog = milestones.find(
    (milestone) =>
      milestone.title.trim().toLowerCase() === SPRINT_BACKLOG_MILESTONE.toLowerCase(),
  );
  return backlog?.id ?? null;
}

export class SprintPlanningService {
  async getBoard(options?: { sprintCount?: number }): Promise<SprintPlanningBoard> {
    const sprintCount = options?.sprintCount ?? 4;
    const monitoredWhere = await buildMonitoredProjectWhere();
    const openState = { state: { notIn: ["DONE", "CLOSED"] as const } };

    const [members, activeSprint, upcomingSprints, backlogRows] =
      await Promise.all([
        db.teamMember.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true, capacity: true },
        }),
        db.sprint.findFirst({
          where: { isActive: true, gitlabMilestoneId: { not: null } },
          orderBy: { startDate: "asc" },
        }),
        db.sprint.findMany({
          where: { gitlabMilestoneId: { not: null } },
          orderBy: { startDate: "asc" },
        }),
        db.workItem.findMany({
          where: mergeWorkItemWhere(
            {
              ...openState,
              type: "ISSUE",
              OR: PLANNING_BACKLOG_MILESTONES.map((milestoneTitle) => ({
                milestoneTitle: { equals: milestoneTitle, mode: "insensitive" as const },
              })),
            },
            monitoredWhere,
          ),
          include: {
            assignee: { select: { name: true } },
            qaOwner: { select: { name: true } },
            project: { select: { name: true, gitlabId: true } },
          },
          orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
        }),
      ]);

    const planningMembers: PlanningMember[] = members;
    const qaMembers: SprintPlanningMember[] = members
      .filter((member) => member.role === "QA")
      .map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
      }));

    const teamTotals = computeTeamWorkloadTotals(
      members.map((member) => ({
        capacity: member.capacity,
        activeItems: 0,
        assignedPoints: 0,
        loadBasis: "active_items" as const,
        isOverloaded: false,
      })),
    );

    const sprintWindow = buildSprintWindow(
      activeSprint,
      upcomingSprints,
      sprintCount,
    );

    const sprintColumns: SprintPlanningColumn[] = [];

    for (const sprint of sprintWindow) {
      const rows = await db.workItem.findMany({
        where: mergeWorkItemWhere(
          {
            ...openState,
            type: "ISSUE",
            OR: [
              { sprintId: sprint.id },
              { milestoneTitle: { equals: sprint.name, mode: "insensitive" } },
            ],
          },
          monitoredWhere,
        ),
        include: {
          assignee: { select: { name: true } },
          qaOwner: { select: { name: true } },
          project: { select: { name: true, gitlabId: true } },
        },
        orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
      });

      const items = rows.map(mapPlanningItem);
      const summary = summarizeSprintItems(items);
      const qaPairedCount = items.filter((item) => item.qaOwnerId != null).length;

      sprintColumns.push({
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate.toISOString(),
        isActive: sprint.isActive,
        gitlabMilestoneId: sprint.gitlabMilestoneId,
        itemCount: items.length,
        plannedPoints: summary.plannedPoints,
        loadBasis: summary.loadBasis,
        qaPairedCount,
        qaUnassignedCount: items.length - qaPairedCount,
        items,
      });
    }

    const activeColumn = sprintColumns.find((column) => column.isActive);
    const dayOne = buildDayOnePlanningSummary(
      planningMembers,
      activeColumn?.itemCount ?? 0,
      activeColumn?.qaPairedCount ?? 0,
    );

    const plannedIds = new Set(
      sprintColumns.flatMap((column) => column.items.map((item) => item.id)),
    );
    const backlog = sortForPlanning(
      backlogRows
        .map(mapPlanningItem)
        .filter((item) => !plannedIds.has(item.id)),
    );

    return {
      generatedAt: new Date().toISOString(),
      teamCapacity: teamTotals.totalCapacity,
      teamWipLimit: teamTotals.totalWipLimit,
      dayOne,
      recommendedSprintItems: recommendedDevSprintItems(planningMembers),
      qaMembers,
      backlog,
      sprints: sprintColumns,
    };
  }

  async assignWorkItems(options: {
    workItemIds: string[];
    sprintId: string;
    syncGitLab?: boolean;
  }): Promise<SprintAssignmentResult> {
    const sprint = await db.sprint.findUnique({
      where: { id: options.sprintId },
    });
    if (!sprint?.gitlabMilestoneId) {
      throw new Error("Sprint is missing a linked GitLab milestone");
    }

    return this.applyMilestoneToWorkItems({
      workItemIds: options.workItemIds,
      sprintId: sprint.id,
      milestoneId: sprint.gitlabMilestoneId,
      milestoneTitle: sprint.name,
      syncGitLab: options.syncGitLab ?? true,
    });
  }

  async moveToSprintBacklog(options: {
    workItemIds: string[];
    syncGitLab?: boolean;
  }): Promise<SprintAssignmentResult> {
    const milestoneId = await resolveSprintBacklogMilestoneId();
    if (!milestoneId) {
      throw new Error("Sprint Backlog milestone not found in GitLab");
    }

    return this.applyMilestoneToWorkItems({
      workItemIds: options.workItemIds,
      sprintId: null,
      milestoneId,
      milestoneTitle: SPRINT_BACKLOG_MILESTONE,
      syncGitLab: options.syncGitLab ?? true,
    });
  }

  async planActiveSprint(options?: {
    maxItems?: number;
    syncGitLab?: boolean;
  }): Promise<SprintAssignmentResult & { selectedIds: string[] }> {
    const board = await this.getBoard({ sprintCount: 1 });
    const activeSprint = board.sprints.find((sprint) => sprint.isActive);
    if (!activeSprint) {
      throw new Error("No active sprint found");
    }

    const maxItems =
      options?.maxItems ?? board.recommendedSprintItems;
    const selectedIds = board.backlog
      .filter((item) => item.milestoneTitle === SPRINT_BACKLOG_MILESTONE)
      .slice(0, maxItems)
      .map((item) => item.id);

    if (selectedIds.length === 0) {
      return {
        sprintId: activeSprint.id,
        sprintName: activeSprint.name,
        assigned: 0,
        gitlabUpdated: 0,
        gitlabSkipped: 0,
        errors: [],
        selectedIds,
      };
    }

    const result = await this.assignWorkItems({
      workItemIds: selectedIds,
      sprintId: activeSprint.id,
      syncGitLab: options?.syncGitLab,
    });

    return { ...result, selectedIds };
  }

  async setQaOwners(options: {
    workItemIds: string[];
    qaOwnerId: string | null;
  }): Promise<SprintQaOwnerResult> {
    const uniqueIds = [...new Set(options.workItemIds)];
    if (uniqueIds.length === 0) {
      return { updated: 0, qaOwnerName: null };
    }

    if (options.qaOwnerId) {
      const qaMember = await db.teamMember.findFirst({
        where: {
          id: options.qaOwnerId,
          role: "QA",
          isActive: true,
        },
      });
      if (!qaMember) {
        throw new Error("QA owner must be an active QA team member");
      }
    }

    const result = await db.workItem.updateMany({
      where: { id: { in: uniqueIds }, type: "ISSUE" },
      data: { qaOwnerId: options.qaOwnerId },
    });

    let qaOwnerName: string | null = null;
    if (options.qaOwnerId) {
      const qaMember = await db.teamMember.findUnique({
        where: { id: options.qaOwnerId },
        select: { name: true },
      });
      qaOwnerName = qaMember?.name ?? null;
    }

    return { updated: result.count, qaOwnerName };
  }

  async autoAssignQaOwnersForActiveSprint(): Promise<SprintQaOwnerResult & { workItemIds: string[] }> {
    const board = await this.getBoard({ sprintCount: 1 });
    const activeSprint = board.sprints.find((sprint) => sprint.isActive);
    if (!activeSprint) {
      throw new Error("No active sprint found");
    }
    if (board.qaMembers.length === 0) {
      throw new Error("No QA members available");
    }

    const unassigned = activeSprint.items.filter((item) => !item.qaOwnerId);
    if (unassigned.length === 0) {
      return { updated: 0, qaOwnerName: null, workItemIds: [] };
    }

    let updated = 0;
    for (const [index, item] of unassigned.entries()) {
      const qaMember = board.qaMembers[index % board.qaMembers.length];
      await db.workItem.update({
        where: { id: item.id },
        data: { qaOwnerId: qaMember.id },
      });
      updated += 1;
    }

    return {
      updated,
      qaOwnerName: "Distributed across QA",
      workItemIds: unassigned.map((item) => item.id),
    };
  }

  private async applyMilestoneToWorkItems(options: {
    workItemIds: string[];
    sprintId: string | null;
    milestoneId: number;
    milestoneTitle: string;
    syncGitLab: boolean;
  }): Promise<SprintAssignmentResult> {
    const uniqueIds = [...new Set(options.workItemIds)];
    if (uniqueIds.length === 0) {
      return {
        sprintId: options.sprintId,
        sprintName: options.sprintId ? options.milestoneTitle : null,
        assigned: 0,
        gitlabUpdated: 0,
        gitlabSkipped: 0,
        errors: [],
      };
    }

    const rows = await db.workItem.findMany({
      where: { id: { in: uniqueIds }, type: "ISSUE" },
      include: {
        project: { select: { gitlabId: true } },
      },
    });

    const config = getGitLabConfig();
    const provider =
      options.syncGitLab && config ? createGitLabProvider(config) : null;

    let gitlabUpdated = 0;
    let gitlabSkipped = 0;
    const errors: Array<{ workItemId: string; message: string }> = [];

    for (const row of rows) {
      try {
        if (provider && row.gitlabIid && row.project.gitlabId) {
          await provider.updateIssue(row.project.gitlabId, row.gitlabIid, {
            milestone_id: options.milestoneId,
          });
          gitlabUpdated += 1;
        } else if (options.syncGitLab) {
          gitlabSkipped += 1;
        }

        await db.workItem.update({
          where: { id: row.id },
          data: {
            sprintId: options.sprintId,
            milestoneId: options.milestoneId,
            milestoneTitle: options.milestoneTitle,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Assignment failed";
        errors.push({ workItemId: row.id, message });
        logger.error("Failed to assign work item to sprint", {
          workItemId: row.id,
          sprintId: options.sprintId,
          error,
        });
      }
    }

    return {
      sprintId: options.sprintId,
      sprintName: options.sprintId ? options.milestoneTitle : null,
      assigned: rows.length - errors.length,
      gitlabUpdated,
      gitlabSkipped,
      errors,
    };
  }
}

function buildSprintWindow(
  activeSprint: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    gitlabMilestoneId: number | null;
  } | null,
  allSprints: Array<{
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    gitlabMilestoneId: number | null;
  }>,
  sprintCount: number,
) {
  const ordered = [...allSprints].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );

  if (!activeSprint) {
    return ordered.slice(0, sprintCount);
  }

  const activeIndex = ordered.findIndex((sprint) => sprint.id === activeSprint.id);
  const startIndex = activeIndex >= 0 ? activeIndex : 0;
  return ordered.slice(startIndex, startIndex + sprintCount);
}

export const sprintPlanningService = new SprintPlanningService();
