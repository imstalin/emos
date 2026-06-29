import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";

import {
  classifyProductBacklog,
  getScopedTypeLabel,
  partitionProductBacklog,
} from "@/domain/backlog/classify-product-backlog";
import type {
  ProductBacklogData,
  ProductBacklogItem,
  ProductBacklogSummary,
} from "@/domain/types/product-backlog";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";
import { getDemoProductBacklogData } from "@/server/services/product-backlog/product-backlog-demo-data";

function mapItem(item: {
  id: string;
  title: string;
  type: ProductBacklogItem["type"];
  state: WorkItemState;
  priority: Priority;
  health: HealthStatus;
  dueDate: Date | null;
  labels: string[];
  webUrl: string | null;
  milestoneTitle: string | null;
  gitlabIid: number | null;
  storyPoints: number | null;
  lastActivityAt: Date | null;
  assignee: { name: string } | null;
  project: { name: string };
}): ProductBacklogItem {
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
    gitlabIid: item.gitlabIid,
    storyPoints: item.storyPoints,
    typeLabel: getScopedTypeLabel(item.labels),
    lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
  };
}

function buildSummary(
  tasks: ProductBacklogItem[],
  defects: ProductBacklogItem[],
): ProductBacklogSummary {
  const all = [...tasks, ...defects];
  const byProject = new Map<string, number>();

  for (const item of all) {
    byProject.set(item.projectName, (byProject.get(item.projectName) ?? 0) + 1);
  }

  return {
    tasks: tasks.length,
    defects: defects.length,
    total: all.length,
    critical: all.filter((item) => item.priority === "CRITICAL").length,
    high: all.filter((item) => item.priority === "HIGH").length,
    unassigned: all.filter((item) => !item.assigneeName).length,
    byProject: [...byProject.entries()]
      .map(([projectName, count]) => ({ projectName, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export class ProductBacklogService {
  async getData(): Promise<ProductBacklogData> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo product backlog — database unavailable");
      return getDemoProductBacklogData();
    }

    try {
      const workItemCount = await db.workItem.count();
      if (workItemCount === 0) {
        return getDemoProductBacklogData();
      }

      return await this.buildFromDatabase();
    } catch (error) {
      logger.error("Failed to load product backlog", { error });
      return getDemoProductBacklogData();
    }
  }

  private async buildFromDatabase(): Promise<ProductBacklogData> {
    const monitoredWhere = await buildMonitoredProjectWhere();

    const rows = await db.workItem.findMany({
      where: mergeWorkItemWhere(
        {
          state: { notIn: ["DONE", "CLOSED"] },
          milestoneTitle: { equals: "Backlog", mode: "insensitive" },
        },
        monitoredWhere,
      ),
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
    });

    const mapped = rows.map(mapItem);
    const partitioned = partitionProductBacklog(mapped);
    const tasks = partitioned.tasks as ProductBacklogItem[];
    const defects = partitioned.defects as ProductBacklogItem[];

    return {
      generatedAt: new Date().toISOString(),
      summary: buildSummary(tasks, defects),
      tasks,
      defects,
    };
  }
}

export const productBacklogService = new ProductBacklogService();
