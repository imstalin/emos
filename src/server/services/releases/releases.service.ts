import type { HealthStatus, Priority, ReleaseStream, WorkItemState } from "@prisma/client";

import type {
  MonthlyReleaseGroup,
  ReleaseChecklistItem,
  ReleaseDetail,
  ReleaseEpicDetail,
  ReleasesDashboard,
} from "@/domain/types/releases";
import type { SprintHealth, WorkItemSummary } from "@/domain/types/dashboard";
import { classifyProductBacklog } from "@/domain/backlog/classify-product-backlog";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDemoReleasesDashboard } from "@/server/services/releases/releases-demo-data";
import {
  formatMonthKeyLabel,
  streamSortOrder,
} from "@/server/services/releases/release-epic.parser";
import { releaseEpicSyncService } from "@/server/services/releases/release-epic-sync.service";
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
  storyPoints?: number | null;
  timeSpentSeconds?: number | null;
  timeEstimateSeconds?: number | null;
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

function estimatePlannedHours(item: {
  storyPoints: number | null;
  timeEstimateSeconds: number | null;
}): number {
  if (item.timeEstimateSeconds && item.timeEstimateSeconds > 0) {
    return Math.round((item.timeEstimateSeconds / 3600) * 10) / 10;
  }
  if (item.storyPoints && item.storyPoints > 0) {
    return item.storyPoints * 4;
  }
  return 0;
}

function spentHoursFromItem(item: { timeSpentSeconds: number | null }): number {
  if (!item.timeSpentSeconds || item.timeSpentSeconds <= 0) return 0;
  return Math.round((item.timeSpentSeconds / 3600) * 10) / 10;
}

export class ReleasesService {
  async syncMonthlyEpics() {
    return releaseEpicSyncService.syncMonthlyReleaseEpics();
  }

  async getDashboard(): Promise<ReleasesDashboard> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo releases dashboard — database unavailable");
      return getDemoReleasesDashboard();
    }

    try {
      const epicCount = await db.releaseEpic.count();
      if (epicCount > 0) {
        return await this.buildFromReleaseEpics();
      }

      const releaseCount = await db.release.count();
      if (releaseCount === 0) {
        return getDemoReleasesDashboard();
      }

      return await this.buildLegacyFromDatabase();
    } catch (error) {
      logger.error("Failed to load releases dashboard", { error });
      return getDemoReleasesDashboard();
    }
  }

  private async buildFromReleaseEpics(): Promise<ReleasesDashboard> {
    const [releaseEpics, activeSprint] = await Promise.all([
      db.releaseEpic.findMany({
        orderBy: [{ monthKey: "desc" }, { epicIid: "asc" }],
      }),
      db.sprint.findFirst({
        where: { isActive: true },
        include: {
          workItems: {
            where: mergeWorkItemWhere(
              { state: { notIn: ["DONE", "CLOSED"] } },
              await buildMonitoredProjectWhere(),
            ),
            include: { project: true, assignee: true },
            orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
            take: 20,
          },
        },
      }),
    ]);

    const epicDetails = await Promise.all(
      releaseEpics.map((epic) => this.buildReleaseEpicDetail(epic)),
    );

    const grouped = new Map<string, ReleaseEpicDetail[]>();
    for (const epic of epicDetails) {
      const bucket = grouped.get(epic.monthKey) ?? [];
      bucket.push(epic);
      grouped.set(epic.monthKey, bucket);
    }

    const monthlyReleases: MonthlyReleaseGroup[] = [...grouped.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([monthKey, epics]) => {
        const sortedEpics = [...epics].sort(
          (a, b) => streamSortOrder(a.stream) - streamSortOrder(b.stream),
        );
        const totalPlannedHours = sortedEpics.reduce(
          (sum, epic) => sum + epic.plannedHours,
          0,
        );
        const totalSpentHours = sortedEpics.reduce(
          (sum, epic) => sum + epic.spentHours,
          0,
        );
        const totalItems = sortedEpics.reduce(
          (sum, epic) => sum + epic.totalItems,
          0,
        );
        const doneItems = sortedEpics.reduce(
          (sum, epic) => sum + epic.doneItems,
          0,
        );

        return {
          monthKey,
          label: formatMonthKeyLabel(monthKey),
          epics: sortedEpics,
          totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
          totalSpentHours: Math.round(totalSpentHours * 10) / 10,
          progressPercent:
            totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
          health: computeOverallHealth(
            sortedEpics.flatMap((epic) =>
              epic.workItems.filter(
                (item) => item.state !== "DONE" && item.state !== "CLOSED",
              ),
            ),
          ),
        };
      });

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

    const openEpics = epicDetails.filter((epic) => epic.state === "opened");
    const atRiskEpics = openEpics.filter(
      (epic) => epic.health === "AT_RISK" || epic.health === "CRITICAL",
    );

    return {
      generatedAt: new Date().toISOString(),
      activeSprint: sprintHealth,
      sprintWorkItems,
      monthlyReleases,
      releases: [],
      summary: {
        upcoming: openEpics.length,
        draft: 0,
        atRisk: atRiskEpics.length,
        activeMonths: monthlyReleases.filter((group) =>
          group.epics.some((epic) => epic.state === "opened"),
        ).length,
        openEpics: openEpics.length,
        totalPlannedHours: Math.round(
          openEpics.reduce((sum, epic) => sum + epic.plannedHours, 0) * 10,
        ) / 10,
        totalSpentHours: Math.round(
          openEpics.reduce((sum, epic) => sum + epic.spentHours, 0) * 10,
        ) / 10,
      },
    };
  }

  private async buildReleaseEpicDetail(epic: {
    id: string;
    epicIid: number;
    title: string;
    stream: ReleaseStream;
    monthKey: string;
    webUrl: string | null;
    state: string;
  }): Promise<ReleaseEpicDetail> {
    const items = await db.workItem.findMany({
      where: { parentEpicIid: epic.epicIid },
      include: { project: true, assignee: true },
      orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
    });

    const openItems = items.filter(
      (item) => item.state !== "DONE" && item.state !== "CLOSED",
    );
    const doneItems = items.filter(
      (item) => item.state === "DONE" || item.state === "CLOSED",
    );
    const blockedItems = openItems.filter((item) => item.state === "BLOCKED");
    const inReviewItems = openItems.filter((item) => item.state === "IN_REVIEW");
    const qaItems = openItems.filter((item) => item.state === "QA");

    const plannedHours = items.reduce(
      (sum, item) => sum + estimatePlannedHours(item),
      0,
    );
    const spentHours = items.reduce(
      (sum, item) => sum + spentHoursFromItem(item),
      0,
    );

    const progressPercent =
      items.length > 0
        ? Math.round((doneItems.length / items.length) * 100)
        : 0;

    return {
      id: epic.id,
      epicIid: epic.epicIid,
      title: epic.title,
      stream: epic.stream,
      monthKey: epic.monthKey,
      webUrl: epic.webUrl,
      state: epic.state,
      plannedHours: Math.round(plannedHours * 10) / 10,
      spentHours: Math.round(spentHours * 10) / 10,
      progressPercent,
      openItems: openItems.length,
      blockedItems: blockedItems.length,
      totalItems: items.length,
      doneItems: doneItems.length,
      inReviewItems: inReviewItems.length,
      qaItems: qaItems.length,
      health: computeOverallHealth(openItems),
      checklist: buildChecklist(openItems),
      workItems: openItems.slice(0, 15).map(mapWorkItem),
    };
  }

  private async buildLegacyFromDatabase(): Promise<ReleasesDashboard> {
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
      monthlyReleases: [],
      releases: releaseDetails,
      summary: {
        upcoming: releaseDetails.filter((release) => !release.isDraft).length,
        draft: releaseDetails.filter((release) => release.isDraft).length,
        atRisk: releaseDetails.filter(
          (release) =>
            release.health === "AT_RISK" || release.health === "CRITICAL",
        ).length,
        activeMonths: 0,
        openEpics: 0,
        totalPlannedHours: 0,
        totalSpentHours: 0,
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
