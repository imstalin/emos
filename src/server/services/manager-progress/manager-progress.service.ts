import { format, startOfDay, subDays } from "date-fns";

import type {
  DsmRow,
  FeedHealthRow,
  ManagerDailySummary,
  ManagerProgressDashboard,
  ManagerProgressFilters,
  ManagerProgressRow,
  MemberProgressView,
  PriorityDetailView,
  ProgressEvidenceItem,
  TeamProgressView,
  WeeklyTrendView,
  WorkItemDetailView,
  WorkItemOverrideInput,
} from "@/domain/types/manager-progress";
import { DEFAULT_LIFECYCLE_STAGES } from "@/domain/types/manager-progress";
import { getStageLabel } from "@/domain/manager-progress/lifecycle-engine";
import {
  progressIndicatorEmoji,
  statusFromIndicator,
  toProgressIndicator,
} from "@/domain/manager-progress/progress-detector";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getManagerProgressFeedIntervalMinutes,
  parseManagerProgressConfig,
} from "@/lib/manager-progress-config";
import { getDemoManagerProgressDashboard } from "@/server/services/manager-progress/manager-progress-demo-data";

function parseDateFilter(date?: string): Date {
  if (!date) return startOfDay(new Date());
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

function mapRow(
  item: Awaited<ReturnType<typeof loadWorkItems>>[number],
  snapshotDate: Date,
): ManagerProgressRow {
  const snapshot = item.snapshots[0];
  const movement = snapshot?.movement ?? "ACTIVE_NO_MOVEMENT";
  const indicator = toProgressIndicator(movement);
  const blocker = item.blockers[0]?.description ?? snapshot?.blocker ?? null;
  const attention = item.attentionItems.length > 0;

  return {
    workItemId: item.id,
    priorityName: item.priority?.name ?? null,
    priorityId: item.priorityId,
    ownerName: item.owner?.name ?? null,
    ownerId: item.ownerId,
    teamName: item.team?.name ?? null,
    teamId: item.teamId,
    progressToday: indicator,
    stage: item.stage,
    stageLabel: getStageLabel(item.stage),
    blocker,
    targetDate: item.targetDate?.toISOString() ?? item.priority?.targetDate?.toISOString() ?? null,
    managerAttention: attention,
    classification: item.classification,
    alignment: item.alignment,
    externalReference: item.externalReference,
    title: item.title,
    nextAction: item.nextAction,
    lastMeaningfulProgressAt: item.lastMeaningfulProgressAt?.toISOString() ?? null,
    activeWipCount: null,
  };
}

async function loadWorkItems(filters: ManagerProgressFilters, snapshotDate: Date) {
  return db.progressWorkItem.findMany({
    where: {
      status: filters.status ?? "active",
      teamId: filters.teamId,
      ownerId: filters.ownerId,
      priorityId: filters.priorityId,
      stage: filters.stage,
      project: filters.project ? { contains: filters.project, mode: "insensitive" } : undefined,
      classification: filters.classification,
      attentionItems: filters.managerAttention
        ? { some: { isDismissed: false, snapshotDate } }
        : undefined,
    },
    include: {
      owner: true,
      team: true,
      priority: true,
      blockers: { where: { isResolved: false }, take: 1 },
      attentionItems: {
        where: { isDismissed: false, snapshotDate },
        take: 1,
      },
      snapshots: {
        where: { snapshotDate },
        take: 1,
      },
    },
    orderBy: [{ priority: { priorityOrder: "asc" } }, { updatedAt: "desc" }],
  });
}

function buildSummary(rows: ManagerProgressRow[]): ManagerDailySummary {
  const moved = rows.filter((r) => r.progressToday === "meaningful_progress");
  const blocked = rows.filter((r) => r.progressToday === "blocked" || r.blocker);
  const releaseReady = rows.filter((r) => r.stage === "release_ready");
  const noMovement = rows.filter((r) => r.progressToday === "active_no_movement");

  return {
    date: format(new Date(), "dd MMM"),
    overall: {
      prioritiesMoved: moved.length,
      prioritiesBlocked: blocked.length,
      releaseReadyCount: releaseReady.length,
    },
    majorProgress: moved.slice(0, 5).map((r) => r.title),
    managerAttention: rows
      .filter((r) => r.managerAttention)
      .slice(0, 5)
      .map((r) => r.blocker ?? r.title),
    noMovement: noMovement.slice(0, 5).map((r) => r.priorityName ?? r.title),
  };
}

export class ManagerProgressService {
  async getDashboard(filters: ManagerProgressFilters = {}): Promise<ManagerProgressDashboard> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      logger.info("Using demo manager progress — database unavailable");
      return getDemoManagerProgressDashboard();
    }

    try {
      const count = await db.progressWorkItem.count();
      if (count === 0) {
        return getDemoManagerProgressDashboard();
      }
      return this.buildDashboard(filters);
    } catch (error) {
      logger.error("Failed to load manager progress dashboard", { error });
      return getDemoManagerProgressDashboard();
    }
  }

  private async buildDashboard(
    filters: ManagerProgressFilters,
  ): Promise<ManagerProgressDashboard> {
    const snapshotDate = parseDateFilter(filters.date);
    const items = await loadWorkItems(filters, snapshotDate);
    const rows = items.map((item) => mapRow(item, snapshotDate));

    const [teams, owners, priorities, feeds] = await Promise.all([
      db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.teamMember.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.engineeringPriority.findMany({
        where: { status: "active" },
        select: { id: true, name: true },
        orderBy: { priorityOrder: "asc" },
      }),
      db.gitLabMemberFeed.findMany({
        include: { member: { include: { team: true } } },
      }),
    ]);

    const configRow = await db.managerProgressConfig.findUnique({
      where: { id: "default" },
    });
    const config = parseManagerProgressConfig(configRow?.config);
    const staleMs = config.thresholds.feedStaleMinutes * 60 * 1000;
    const feedHealthWarning = feeds.some((feed) => {
      if (!feed.isEnabled) return false;
      if (!feed.lastSuccessAt) return true;
      return Date.now() - feed.lastSuccessAt.getTime() > staleMs;
    });

    const moving = rows.filter((r) => r.progressToday === "meaningful_progress");
    const stagnant = rows.filter((r) => r.progressToday === "active_no_movement");
    const blocked = rows.filter((r) => r.blocker || r.progressToday === "blocked");
    const attention = rows.filter((r) => r.managerAttention);
    const releaseReady = rows.filter((r) =>
      ["release_ready", "production", "pprd"].includes(r.stage),
    );
    const unplanned = rows.filter((r) => r.alignment === "UNPLANNED");

    const sections = [
      { key: "moving", title: "Priorities Moving Today", items: moving },
      { key: "stagnant", title: "Priorities With No Movement", items: stagnant },
      { key: "blocked", title: "Blocked Work", items: blocked },
      { key: "attention", title: "Manager Attention", items: attention },
      { key: "release", title: "Release / Production Readiness", items: releaseReady },
      { key: "unplanned", title: "Unplanned / Support Work", items: unplanned },
    ];

    return {
      generatedAt: new Date().toISOString(),
      date: format(snapshotDate, "yyyy-MM-dd"),
      feedHealthWarning,
      summary: buildSummary(rows),
      sections,
      mainTable: rows,
      filters: {
        teams,
        owners,
        priorities,
        stages: config.lifecycleStages.length
          ? config.lifecycleStages
          : DEFAULT_LIFECYCLE_STAGES,
      },
    };
  }

  async getFeedHealth(): Promise<FeedHealthRow[]> {
    const connected = await checkDatabaseConnection();
    if (!connected) return [];

    const configRow = await db.managerProgressConfig.findUnique({
      where: { id: "default" },
    });
    const config = parseManagerProgressConfig(configRow?.config);
    const staleMs = config.thresholds.feedStaleMinutes * 60 * 1000;

    const feeds = await db.gitLabMemberFeed.findMany({
      include: { member: { include: { team: true } } },
      orderBy: { member: { name: "asc" } },
    });

    return feeds.map((feed) => {
      let status: FeedHealthRow["status"] = "healthy";
      if (!feed.isEnabled) status = "disabled";
      else if (feed.lastError) status = "error";
      else if (
        !feed.lastSuccessAt ||
        Date.now() - feed.lastSuccessAt.getTime() > staleMs
      ) {
        status = "stale";
      }

      return {
        memberId: feed.memberId,
        memberName: feed.member.name,
        gitlabUsername: feed.member.gitlabHandle,
        teamName: feed.member.team.name,
        feedEnabled: feed.isEnabled,
        status,
        lastSuccessfulFetch: feed.lastSuccessAt?.toISOString() ?? null,
        lastEventReceived: feed.lastEventAt?.toISOString() ?? null,
        lastHttpStatus: feed.lastHttpStatus,
        lastError: feed.lastError,
      };
    });
  }

  async getMemberView(memberId: string, date?: string): Promise<MemberProgressView | null> {
    const member = await db.teamMember.findUnique({
      where: { id: memberId },
      include: { team: true },
    });
    if (!member) return null;

    const snapshotDate = parseDateFilter(date);
    const items = await loadWorkItems({ ownerId: memberId }, snapshotDate);
    const rows = items.map((item) => mapRow(item, snapshotDate));
    const configRow = await db.managerProgressConfig.findUnique({
      where: { id: "default" },
    });
    const config = parseManagerProgressConfig(configRow?.config);
    const activeWip = rows.filter(
      (r) => !["completed", "backlog"].includes(r.stage),
    ).length;

    const evidence = await this.loadEvidenceForMember(memberId, snapshotDate);

    return {
      memberId,
      memberName: member.name,
      teamName: member.team.name,
      activeWip,
      recommendedWip: config.thresholds.maxActiveWip,
      contextSwitchingRisk: activeWip > config.thresholds.maxActiveWip,
      priorities: rows.filter((r) => r.alignment !== "UNPLANNED"),
      unplannedWork: rows.filter((r) => r.alignment === "UNPLANNED"),
      evidence,
    };
  }

  async getTeamView(teamId: string, date?: string): Promise<TeamProgressView | null> {
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) return null;
    const snapshotDate = parseDateFilter(date);
    const items = await loadWorkItems({ teamId }, snapshotDate);
    return {
      teamId,
      teamName: team.name,
      items: items.map((item) => mapRow(item, snapshotDate)),
    };
  }

  async getPriorityView(priorityId: string, date?: string): Promise<PriorityDetailView | null> {
    const priority = await db.engineeringPriority.findUnique({
      where: { id: priorityId },
    });
    if (!priority) return null;

    const snapshotDate = parseDateFilter(date);
    const items = await loadWorkItems({ priorityId }, snapshotDate);
    const rows = items.map((item) => mapRow(item, snapshotDate));
    const primary = rows[0];
    if (!primary) {
      return {
        priorityId,
        name: priority.name,
        status: "no_movement",
        stage: "backlog",
        stageLabel: "Backlog",
        progressToday: "active_no_movement",
        todaySummary: [],
        contributors: [],
        nextAction: null,
        blocker: null,
        targetDate: priority.targetDate?.toISOString() ?? null,
        workItems: [],
        evidence: [],
      };
    }

    const contributors = [
      ...new Set(rows.map((r) => r.ownerName).filter(Boolean) as string[]),
    ];
    const evidence = await this.loadEvidenceForPriority(priorityId, snapshotDate);

    return {
      priorityId,
      name: priority.name,
      status: statusFromIndicator(primary.progressToday, Boolean(primary.blocker)),
      stage: primary.stage,
      stageLabel: primary.stageLabel,
      progressToday: primary.progressToday,
      todaySummary: rows
        .filter((r) => r.progressToday === "meaningful_progress")
        .map((r) => r.title),
      contributors,
      nextAction: primary.nextAction,
      blocker: primary.blocker,
      targetDate: priority.targetDate?.toISOString() ?? null,
      workItems: rows,
      evidence,
    };
  }

  async getWorkItemDetail(workItemId: string): Promise<WorkItemDetailView | null> {
    const item = await db.progressWorkItem.findUnique({
      where: { id: workItemId },
      include: {
        owner: true,
        team: true,
        priority: true,
        blockers: true,
        attentionItems: { where: { isDismissed: false } },
        snapshots: { orderBy: { snapshotDate: "desc" }, take: 14 },
        activityLinks: {
          include: {
            activity: { include: { member: true } },
          },
          orderBy: { activity: { timestamp: "desc" } },
          take: 50,
        },
      },
    });
    if (!item) return null;

    const row = mapRow(
      {
        ...item,
        blockers: item.blockers.filter((b) => !b.isResolved).slice(0, 1),
        attentionItems: item.attentionItems.slice(0, 1),
        snapshots: item.snapshots.slice(0, 1),
      },
      startOfDay(new Date()),
    );

    return {
      workItem: row,
      evidence: item.activityLinks.map((link) => ({
        id: link.activity.id,
        timestamp: link.activity.timestamp.toISOString(),
        eventType: link.activity.eventType,
        title: link.activity.title,
        url: link.activity.url,
        memberName: link.activity.member.name,
      })),
      blockers: item.blockers.map((b) => ({
        id: b.id,
        category: b.category,
        description: b.description,
        isConfirmed: b.isConfirmed,
        isResolved: b.isResolved,
      })),
      attentionItems: item.attentionItems.map((a) => ({
        id: a.id,
        ruleKey: a.ruleKey,
        title: a.title,
        description: a.description,
        severity: a.severity,
      })),
      snapshots: item.snapshots.map((s) => ({
        date: format(s.snapshotDate, "yyyy-MM-dd"),
        previousStage: s.previousStage,
        currentStage: s.currentStage,
        movement: s.movement,
        summary: s.summary,
      })),
    };
  }

  async applyOverride(
    workItemId: string,
    input: WorkItemOverrideInput,
    authorId?: string,
  ): Promise<boolean> {
    const item = await db.progressWorkItem.findUnique({ where: { id: workItemId } });
    if (!item) return false;

    const oldValue = String(
      (item as Record<string, unknown>)[input.field] ?? "",
    );

    await db.managerOverride.create({
      data: {
        workItemId,
        authorId,
        field: input.field,
        oldValue,
        newValue: input.newValue,
        reason: input.reason,
      },
    });

    const allowedFields = [
      "stage",
      "priorityId",
      "ownerId",
      "classification",
      "alignment",
      "targetDate",
      "nextAction",
      "title",
      "status",
    ] as const;

    if (!allowedFields.includes(input.field as (typeof allowedFields)[number])) {
      return false;
    }

    await db.progressWorkItem.update({
      where: { id: workItemId },
      data: { [input.field]: input.newValue },
    });

    return true;
  }

  async getWeeklyTrend(): Promise<WeeklyTrendView> {
    const weekStart = startOfDay(subDays(new Date(), 7));
    const weekEnd = startOfDay(new Date());

    const snapshots = await db.progressSnapshot.findMany({
      where: { snapshotDate: { gte: weekStart, lte: weekEnd } },
    });

    const workItems = await db.progressWorkItem.findMany({
      where: { updatedAt: { gte: weekStart } },
    });

    return {
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
      prioritiesCompleted: snapshots.filter((s) => s.movement === "COMPLETED").length,
      prioritiesProgressed: snapshots.filter(
        (s) => s.movement === "MEANINGFUL_PROGRESS",
      ).length,
      itemsBlocked: snapshots.filter((s) => s.movement === "BLOCKED").length,
      itemsStagnant: snapshots.filter(
        (s) => s.movement === "ACTIVE_NO_MOVEMENT",
      ).length,
      unplannedWorkCount: workItems.filter((w) => w.alignment === "UNPLANNED").length,
      mrReviewDelays: workItems.filter((w) => w.stage === "code_review").length,
      qaWaitingCount: workItems.filter((w) => w.stage === "qa_ready").length,
      productionCompletions: snapshots.filter(
        (s) => s.currentStage === "production" || s.currentStage === "completed",
      ).length,
    };
  }

  async getDsmView(date?: string): Promise<DsmRow[]> {
    const snapshotDate = parseDateFilter(date);
    const yesterday = subDays(snapshotDate, 1);
    const items = await db.progressWorkItem.findMany({
      where: { status: "active" },
      include: {
        owner: true,
        priority: true,
        snapshots: {
          where: { snapshotDate: { in: [snapshotDate, yesterday] } },
        },
        blockers: { where: { isResolved: false }, take: 1 },
      },
    });

    return items.map((item) => {
      const todaySnap = item.snapshots.find(
        (s) => format(s.snapshotDate, "yyyy-MM-dd") === format(snapshotDate, "yyyy-MM-dd"),
      );
      const yesterdaySnap = item.snapshots.find(
        (s) => format(s.snapshotDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"),
      );

      return {
        ownerName: item.owner?.name ?? "Unassigned",
        priorityName: item.priority?.name ?? item.title,
        yesterdayMovement: yesterdaySnap?.summary ?? "No recorded movement",
        todayMilestone: todaySnap?.summary ?? item.nextAction ?? "—",
        blocker: item.blockers[0]?.description ?? null,
        targetDate:
          item.targetDate?.toISOString() ??
          item.priority?.targetDate?.toISOString() ??
          null,
      };
    });
  }

  private async loadEvidenceForMember(
    memberId: string,
    snapshotDate: Date,
  ): Promise<ProgressEvidenceItem[]> {
    const end = new Date(snapshotDate);
    end.setHours(23, 59, 59, 999);

    const activities = await db.gitLabFeedActivity.findMany({
      where: {
        memberId,
        timestamp: { gte: snapshotDate, lte: end },
      },
      include: { member: true },
      orderBy: { timestamp: "asc" },
      take: 30,
    });

    return activities.map((a) => ({
      id: a.id,
      timestamp: a.timestamp.toISOString(),
      eventType: a.eventType,
      title: a.title,
      url: a.url,
      memberName: a.member.name,
    }));
  }

  private async loadEvidenceForPriority(
    priorityId: string,
    snapshotDate: Date,
  ): Promise<ProgressEvidenceItem[]> {
    const end = new Date(snapshotDate);
    end.setHours(23, 59, 59, 999);

    const links = await db.progressWorkItemActivity.findMany({
      where: {
        workItem: { priorityId },
        activity: { timestamp: { gte: snapshotDate, lte: end } },
      },
      include: {
        activity: { include: { member: true } },
      },
      orderBy: { activity: { timestamp: "asc" } },
      take: 30,
    });

    return links.map((link) => ({
      id: link.activity.id,
      timestamp: link.activity.timestamp.toISOString(),
      eventType: link.activity.eventType,
      title: link.activity.title,
      url: link.activity.url,
      memberName: link.activity.member.name,
    }));
  }

  getSchedulerInfo() {
    return {
      enabled: true,
      intervalMinutes: getManagerProgressFeedIntervalMinutes(),
    };
  }
}

export const managerProgressService = new ManagerProgressService();

export { progressIndicatorEmoji };
