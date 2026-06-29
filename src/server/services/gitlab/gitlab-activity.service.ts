import type { Prisma } from "@prisma/client";

import type {
  GitLabActivityFilters,
  GitLabActivityItem,
  GitLabActivityResult,
  GitLabActivityStats,
} from "@/domain/types/gitlab-activity";
import { db } from "@/lib/db";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function mapItem(
  item: {
    id: string;
    title: string;
    type: GitLabActivityItem["type"];
    state: GitLabActivityItem["state"];
    priority: GitLabActivityItem["priority"];
    health: GitLabActivityItem["health"];
    labels: string[];
    dueDate: Date | null;
    webUrl: string | null;
    lastActivityAt: Date | null;
    gitlabIid: number | null;
    projectId: string;
    project: { name: string };
    assignee: { name: string } | null;
  },
): GitLabActivityItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    state: item.state,
    priority: item.priority,
    health: item.health,
    assigneeName: item.assignee?.name ?? null,
    projectId: item.projectId,
    projectName: item.project.name,
    dueDate: item.dueDate?.toISOString() ?? null,
    labels: item.labels,
    webUrl: item.webUrl,
    lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
    gitlabIid: item.gitlabIid,
  };
}

export class GitLabActivityService {
  async getActivity(
    filters: GitLabActivityFilters = {},
  ): Promise<GitLabActivityResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, filters.limit ?? DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const monitoredWhere = await buildMonitoredProjectWhere();
    const where = this.buildWhere(filters, monitoredWhere);

    const [items, total, stats, projects] = await Promise.all([
      db.workItem.findMany({
        where,
        include: {
          project: { select: { name: true } },
          assignee: { select: { name: true } },
        },
        orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
        skip,
        take: limit,
      }),
      db.workItem.count({ where }),
      this.getStats(filters, monitoredWhere),
      this.getProjectOptions(monitoredWhere),
    ]);

    return {
      items: items.map(mapItem),
      total,
      page,
      limit,
      stats,
      projects,
    };
  }

  private buildWhere(
    filters: GitLabActivityFilters,
    monitoredWhere: Prisma.WorkItemWhereInput = {},
  ): Prisma.WorkItemWhereInput {
    const where: Prisma.WorkItemWhereInput = mergeWorkItemWhere(
      { syncSource: "GITLAB_API" },
      monitoredWhere,
    );

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.state) {
      where.state = filters.state;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { labels: { has: search } },
      ];
    }

    return where;
  }

  private async getStats(
    filters: GitLabActivityFilters,
    monitoredWhere: Prisma.WorkItemWhereInput = {},
  ): Promise<GitLabActivityStats> {
    const baseWhere = this.buildWhere(
      {
        ...filters,
        type: undefined,
        state: undefined,
        priority: undefined,
      },
      monitoredWhere,
    );

    const [total, issues, mergeRequests, open, inProgress, inReview, blocked] =
      await Promise.all([
        db.workItem.count({ where: baseWhere }),
        db.workItem.count({
          where: { ...baseWhere, type: "ISSUE" },
        }),
        db.workItem.count({
          where: { ...baseWhere, type: "MERGE_REQUEST" },
        }),
        db.workItem.count({
          where: { ...baseWhere, state: "OPEN" },
        }),
        db.workItem.count({
          where: { ...baseWhere, state: "IN_PROGRESS" },
        }),
        db.workItem.count({
          where: { ...baseWhere, state: "IN_REVIEW" },
        }),
        db.workItem.count({
          where: { ...baseWhere, state: "BLOCKED" },
        }),
      ]);

    return {
      total,
      issues,
      mergeRequests,
      open,
      inProgress,
      inReview,
      blocked,
    };
  }

  private async getProjectOptions(monitoredWhere: Prisma.WorkItemWhereInput = {}) {
    const grouped = await db.workItem.groupBy({
      by: ["projectId"],
      where: mergeWorkItemWhere({ syncSource: "GITLAB_API" }, monitoredWhere),
      _count: { _all: true },
      orderBy: { _count: { projectId: "desc" } },
      take: 50,
    });

    if (grouped.length === 0) {
      return [];
    }

    const projectIds = grouped.map((row) => row.projectId);
    const projects = await db.gitLabProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });

    const nameById = new Map(projects.map((project) => [project.id, project.name]));

    return grouped
      .map((row) => ({
        id: row.projectId,
        name: nameById.get(row.projectId) ?? "Unknown",
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }
}

export const gitlabActivityService = new GitLabActivityService();
