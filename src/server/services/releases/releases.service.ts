import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";

import type {
  ReleaseChecklistItem,
  ReleaseDetail,
  ReleasesDashboard,
} from "@/domain/types/releases";
import type { SprintHealth, WorkItemSummary } from "@/domain/types/dashboard";
import { classifyProductBacklog } from "@/domain/backlog/classify-product-backlog";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDemoReleasesDashboard } from "@/server/services/releases/releases-demo-data";
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

function computeOverallHealth(items: { health: HealthStatus }[]): HealthStatus {
  if (items.some((item) => item.health === "CRITICAL")) return "CRITICAL";
  if (items.some((item) => item.health === "AT_RISK")) return "AT_RISK";
  if (items.length > 0) return "HEALTHY";
  return "UNKNOWN";
}

function matchesReleaseScope(
  item: { labels: string[]; title: string; projectId: string },
  release: { projectId: string; version: string },
): boolean {
  if (item.projectId !== release.projectId) return false;

  const versionToken = release.version.replace(/^v/i, "");
  const majorMinor = versionToken.split(".").slice(0, 2).join(".");

  return item.labels.some((label) => {
    const normalized = label.toLowerCase();
    return (
      normalized.includes(versionToken.toLowerCase()) ||
      normalized.includes(majorMinor) ||
      normalized.includes(`release-${majorMinor}`)
    );
  });
}

function buildChecklist(
  openItems: Array<{
    state: WorkItemState;
    priority: Priority;
  }>,
): ReleaseChecklistItem[] {
  const blocked = openItems.filter((item) => item.state === "BLOCKED");
  const critical = openItems.filter((item) => item.priority === "CRITICAL");
  const inReview = openItems.filter((item) => item.state === "IN_REVIEW");
  const inQa = openItems.filter((item) => item.state === "QA");

  return [
    {
      id: "blockers",
      label: "No blockers",
      status: blocked.length === 0 ? "complete" : "at_risk",
      detail:
        blocked.length === 0
          ? "No blocked work items"
          : `${blocked.length} blocked item${blocked.length > 1 ? "s" : ""}`,
    },
    {
      id: "critical",
      label: "Critical items cleared",
      status: critical.length === 0 ? "complete" : "at_risk",
      detail:
        critical.length === 0
          ? "No open critical items"
          : `${critical.length} critical item${critical.length > 1 ? "s" : ""} open`,
    },
    {
      id: "review",
      label: "Code review complete",
      status:
        inReview.length === 0
          ? "complete"
          : inReview.length <= 5
            ? "at_risk"
            : "pending",
      detail: `${inReview.length} item${inReview.length === 1 ? "" : "s"} in review`,
    },
    {
      id: "qa",
      label: "QA sign-off",
      status: inQa.length === 0 ? "complete" : "pending",
      detail: `${inQa.length} item${inQa.length === 1 ? "" : "s"} in QA`,
    },
  ];
}

export class ReleasesService {
  async getDashboard(): Promise<ReleasesDashboard> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo releases dashboard — database unavailable");
      return getDemoReleasesDashboard();
    }

    try {
      const releaseCount = await db.release.count();
      if (releaseCount === 0) {
        return getDemoReleasesDashboard();
      }

      return await this.buildFromDatabase();
    } catch (error) {
      logger.error("Failed to load releases dashboard", { error });
      return getDemoReleasesDashboard();
    }
  }

  private async buildFromDatabase(): Promise<ReleasesDashboard> {
    const monitoredWhere = await buildMonitoredProjectWhere();
    const monitoredDbIds = await getMonitoredProjectDbIds();
    const activeFilter = mergeWorkItemWhere(
      { state: { notIn: ["DONE", "CLOSED"] } },
      monitoredWhere,
    );

    const [releases, activeSprint] = await Promise.all([
      db.release.findMany({
        where: {
          releasedAt: null,
          ...(monitoredDbIds ? { projectId: { in: monitoredDbIds } } : {}),
        },
        include: { project: true },
        orderBy: [{ targetDate: "asc" }, { version: "desc" }],
      }),
      db.sprint.findFirst({
        where: { isActive: true },
        include: {
          workItems: {
            where: activeFilter,
            include: { project: true, assignee: true },
            orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
            take: 20,
          },
        },
      }),
    ]);

    const releaseDetails = await Promise.all(
      releases.map((release) => this.buildReleaseDetail(release)),
    );

    let sprintHealth: SprintHealth | null = null;
    let sprintWorkItems: WorkItemSummary[] = [];

    if (activeSprint) {
      const allSprintItems = await db.workItem.findMany({
        where: { sprintId: activeSprint.id },
      });
      const completed = allSprintItems.filter((item) => item.state === "DONE");
      const totalPoints = allSprintItems.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      );
      const completedPoints = completed.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      );

      sprintHealth = {
        id: activeSprint.id,
        name: activeSprint.name,
        goal: activeSprint.goal,
        startDate: activeSprint.startDate.toISOString(),
        endDate: activeSprint.endDate.toISOString(),
        completedPoints,
        totalPoints,
        velocity: completedPoints,
        health: computeOverallHealth(allSprintItems),
        daysRemaining: Math.max(
          0,
          Math.ceil(
            (activeSprint.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        ),
      };

      sprintWorkItems = activeSprint.workItems.map(mapWorkItem);
    }

    return {
      generatedAt: new Date().toISOString(),
      activeSprint: sprintHealth,
      sprintWorkItems,
      releases: releaseDetails,
      summary: {
        upcoming: releaseDetails.filter((release) => !release.isDraft).length,
        draft: releaseDetails.filter((release) => release.isDraft).length,
        atRisk: releaseDetails.filter(
          (release) =>
            release.health === "AT_RISK" || release.health === "CRITICAL",
        ).length,
      },
    };
  }

  private async buildReleaseDetail(release: {
    id: string;
    projectId: string;
    version: string;
    name: string | null;
    description: string | null;
    targetDate: Date | null;
    releasedAt: Date | null;
    isDraft: boolean;
    project: { name: string };
  }): Promise<ReleaseDetail> {
    const projectItems = await db.workItem.findMany({
      where: { projectId: release.projectId },
      include: { project: true, assignee: true },
      orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
    });

    const scopedItems = projectItems.filter((item) =>
      matchesReleaseScope(item, release),
    );
    const items = scopedItems.length > 0 ? scopedItems : projectItems;

    const openItems = items.filter(
      (item) => item.state !== "DONE" && item.state !== "CLOSED",
    );
    const doneItems = items.filter(
      (item) => item.state === "DONE" || item.state === "CLOSED",
    );
    const blockedItems = openItems.filter((item) => item.state === "BLOCKED");
    const inReviewItems = openItems.filter((item) => item.state === "IN_REVIEW");
    const qaItems = openItems.filter((item) => item.state === "QA");
    const criticalItems = openItems.filter(
      (item) => item.priority === "CRITICAL",
    );

    const progressPercent =
      items.length > 0
        ? Math.round((doneItems.length / items.length) * 100)
        : 0;

    return {
      id: release.id,
      version: release.version,
      name: release.name,
      description: release.description,
      projectName: release.project.name,
      projectId: release.projectId,
      targetDate: release.targetDate?.toISOString() ?? null,
      releasedAt: release.releasedAt?.toISOString() ?? null,
      isDraft: release.isDraft,
      openItems: openItems.length,
      blockedItems: blockedItems.length,
      health: computeOverallHealth(openItems),
      progressPercent,
      totalItems: items.length,
      doneItems: doneItems.length,
      inReviewItems: inReviewItems.length,
      qaItems: qaItems.length,
      criticalItems: criticalItems.length,
      checklist: buildChecklist(openItems),
      workItems: openItems.slice(0, 15).map(mapWorkItem),
    };
  }
}

export const releasesService = new ReleasesService();
