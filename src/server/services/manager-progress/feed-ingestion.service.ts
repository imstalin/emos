import type { Prisma } from "@prisma/client";

import { parseGitLabAtomFeed } from "@/domain/manager-progress/atom-parser";
import {
  correlationKeyForGrouping,
  deriveCorrelationKey,
} from "@/domain/manager-progress/work-item-correlator";
import {
  classifyWorkFromEvent,
  inferStageFromEvent,
} from "@/domain/manager-progress/lifecycle-engine";
import { detectBlockersFromActivity } from "@/domain/manager-progress/blocker-detector";
import { determineMovement } from "@/domain/manager-progress/progress-detector";
import { evaluateAttentionRules } from "@/domain/manager-progress/attention-rules";
import type { NormalizedFeedActivity } from "@/domain/types/manager-progress";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  parseManagerProgressConfig,
} from "@/lib/manager-progress-config";
import { DEFAULT_MANAGER_PROGRESS_CONFIG } from "@/domain/types/manager-progress";
import { fetchGitLabAtomFeed } from "@/server/services/manager-progress/feed-fetch.service";

export interface FeedIngestionResult {
  memberId: string;
  fetched: boolean;
  inserted: number;
  skipped: number;
  error: string | null;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function mapClassification(
  value: ReturnType<typeof classifyWorkFromEvent>,
): Prisma.WorkClassification {
  const map: Record<string, Prisma.WorkClassification> = {
    HOTFIX: "HOTFIX",
    PRODUCTION_SUPPORT: "PRODUCTION_SUPPORT",
    DEFECT: "DEFECT",
    ENHANCEMENT: "ENHANCEMENT",
    PLANNED_FEATURE: "PLANNED_FEATURE",
    TECHNICAL_MAINTENANCE: "TECHNICAL_MAINTENANCE",
    UNKNOWN: "UNKNOWN",
  };
  return map[value] ?? "UNKNOWN";
}

async function loadConfig() {
  const row = await db.managerProgressConfig.findUnique({
    where: { id: "default" },
  });
  return parseManagerProgressConfig(row?.config ?? DEFAULT_MANAGER_PROGRESS_CONFIG);
}

async function alignToPriority(
  externalReference: string | null,
  title: string,
  project: string | null,
) {
  const priorities = await db.engineeringPriority.findMany({
    where: { status: "active" },
    orderBy: { priorityOrder: "asc" },
  });

  for (const priority of priorities) {
    const keywords = priority.keywords.map((k) => k.toLowerCase());
    const haystack = `${externalReference ?? ""} ${title} ${project ?? ""}`.toLowerCase();
    if (keywords.some((keyword) => keyword && haystack.includes(keyword))) {
      return { priorityId: priority.id, alignment: "ALIGNED" as const };
    }
    if (
      priority.projectMappings.some((mapping) =>
        project?.toLowerCase().includes(mapping.toLowerCase()),
      )
    ) {
      return { priorityId: priority.id, alignment: "ALIGNED" as const };
    }
  }

  return { priorityId: null, alignment: "UNKNOWN" as const };
}

async function processActivityPipeline(
  activity: NormalizedFeedActivity & { id: string; memberId: string },
  config: ReturnType<typeof parseManagerProgressConfig>,
): Promise<void> {
  const member = await db.teamMember.findUnique({
    where: { id: activity.memberId },
    include: { team: true },
  });
  if (!member) return;

  const signal = deriveCorrelationKey(activity);
  const groupKey = correlationKeyForGrouping(signal);

  let workItem = await db.progressWorkItem.findFirst({
    where: {
      OR: [
        signal.externalReference
          ? { externalReference: signal.externalReference }
          : undefined,
        { title: { equals: signal.title, mode: "insensitive" } },
      ].filter(Boolean) as Prisma.ProgressWorkItemWhereInput[],
      ownerId: member.id,
    },
    orderBy: { updatedAt: "desc" },
  });

  const alignmentResult = await alignToPriority(
    signal.externalReference,
    signal.title,
    activity.project,
  );

  const classification = mapClassification(
    classifyWorkFromEvent(activity.eventType, activity.title, activity.description ?? ""),
  );

  const previousStage = workItem?.stage ?? "backlog";
  const nextStage = inferStageFromEvent(activity.eventType, previousStage);

  if (!workItem) {
    workItem = await db.progressWorkItem.create({
      data: {
        externalReference: signal.externalReference,
        title: signal.title,
        project: activity.project,
        ownerId: member.id,
        teamId: member.teamId,
        priorityId: alignmentResult.priorityId,
        alignment: alignmentResult.alignment,
        classification,
        stage: nextStage,
        correlationConfidence: signal.confidence,
        lastMeaningfulProgressAt: activity.timestamp,
      },
    });
  } else {
    workItem = await db.progressWorkItem.update({
      where: { id: workItem.id },
      data: {
        stage: nextStage,
        project: activity.project ?? workItem.project,
        priorityId: workItem.priorityId ?? alignmentResult.priorityId,
        alignment:
          workItem.alignment === "UNKNOWN"
            ? alignmentResult.alignment
            : workItem.alignment,
        classification:
          workItem.classification === "UNKNOWN"
            ? classification
            : workItem.classification,
        lastMeaningfulProgressAt:
          nextStage !== previousStage ? activity.timestamp : workItem.lastMeaningfulProgressAt,
        updatedAt: new Date(),
      },
    });
  }

  await db.progressWorkItemActivity.upsert({
    where: {
      workItemId_activityId: {
        workItemId: workItem.id,
        activityId: activity.id,
      },
    },
    create: { workItemId: workItem.id, activityId: activity.id },
    update: {},
  });

  const blockers = detectBlockersFromActivity(activity);
  for (const blocker of blockers) {
    const existing = await db.progressBlocker.findFirst({
      where: {
        workItemId: workItem.id,
        description: blocker.description,
        isResolved: false,
      },
    });
    if (!existing) {
      await db.progressBlocker.create({
        data: {
          workItemId: workItem.id,
          category: blocker.category,
          description: blocker.description,
          isConfirmed: blocker.isConfirmed,
          sourceActivityId: activity.id,
        },
      });
    }
  }

  const hasBlocker = blockers.length > 0;
  const movement = determineMovement(
    previousStage,
    nextStage,
    activity.eventType,
    hasBlocker,
  );

  const snapshotDate = startOfDay(activity.timestamp);
  const summary = `${activity.title}`;

  await db.progressSnapshot.upsert({
    where: {
      workItemId_snapshotDate: {
        workItemId: workItem.id,
        snapshotDate,
      },
    },
    create: {
      workItemId: workItem.id,
      snapshotDate,
      previousStage,
      currentStage: nextStage,
      movement,
      summary,
      blocker: blockers[0]?.description ?? null,
    },
    update: {
      currentStage: nextStage,
      movement,
      summary: summary,
      blocker: blockers[0]?.description ?? undefined,
    },
  });

  const activeWip = await db.progressWorkItem.count({
    where: {
      ownerId: member.id,
      status: "active",
      stage: { notIn: ["completed", "backlog"] },
    },
  });

  const attentionHits = evaluateAttentionRules(
    {
      workItemId: workItem.id,
      priorityName: null,
      priorityId: workItem.priorityId,
      title: workItem.title,
      stage: workItem.stage,
      progressToday:
        movement === "MEANINGFUL_PROGRESS"
          ? "meaningful_progress"
          : movement === "BLOCKED"
            ? "blocked"
            : "active_no_movement",
      lastMeaningfulProgressAt: workItem.lastMeaningfulProgressAt,
      targetDate: workItem.targetDate,
      releaseDate: null,
      activeWipCount: activeWip,
      alignment: workItem.alignment,
      hasBlocker,
      ownerName: member.name,
    },
    config.thresholds,
    config.holidays,
  );

  for (const hit of attentionHits) {
    const exists = await db.managerAttentionItem.findFirst({
      where: {
        workItemId: hit.workItemId,
        ruleKey: hit.ruleKey,
        snapshotDate,
        isDismissed: false,
      },
    });
    if (!exists) {
      await db.managerAttentionItem.create({
        data: {
          workItemId: hit.workItemId,
          priorityId: hit.priorityId,
          ruleKey: hit.ruleKey,
          title: hit.title,
          description: hit.description,
          severity: hit.severity,
          snapshotDate,
        },
      });
    }
  }

  void groupKey;
}

export class FeedIngestionService {
  async ingestMemberFeed(memberId: string): Promise<FeedIngestionResult> {
    const feed = await db.gitLabMemberFeed.findUnique({
      where: { memberId },
      include: { member: true },
    });

    if (!feed) {
      return {
        memberId,
        fetched: false,
        inserted: 0,
        skipped: 0,
        error: "Feed not configured",
      };
    }

    if (!feed.isEnabled) {
      return {
        memberId,
        fetched: false,
        inserted: 0,
        skipped: 0,
        error: "Feed disabled",
      };
    }

    const now = new Date();
    await db.gitLabMemberFeed.update({
      where: { id: feed.id },
      data: { lastFetchAt: now },
    });

    const fetchResult = await fetchGitLabAtomFeed(feed.feedEnvKey);
    if (!fetchResult.ok || !fetchResult.body) {
      await db.gitLabMemberFeed.update({
        where: { id: feed.id },
        data: {
          lastHttpStatus: fetchResult.status || null,
          lastError: fetchResult.error,
        },
      });
      return {
        memberId,
        fetched: false,
        inserted: 0,
        skipped: 0,
        error: fetchResult.error,
      };
    }

    let activities: NormalizedFeedActivity[];
    try {
      activities = parseGitLabAtomFeed(fetchResult.body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Atom parse failed";
      await db.gitLabMemberFeed.update({
        where: { id: feed.id },
        data: { parseError: message, lastError: message },
      });
      return {
        memberId,
        fetched: true,
        inserted: 0,
        skipped: 0,
        error: message,
      };
    }

    const config = await loadConfig();
    let inserted = 0;
    let skipped = 0;
    let lastEventAt: Date | null = feed.lastEventAt;
    let lastEventId: string | null = feed.lastEventId;

    for (const activity of activities) {
      const existing = await db.gitLabFeedActivity.findUnique({
        where: { gitlabEventId: activity.gitlabEventId },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const created = await db.gitLabFeedActivity.create({
        data: {
          feedId: feed.id,
          memberId: feed.memberId,
          gitlabEventId: activity.gitlabEventId,
          eventType: activity.eventType,
          title: activity.title,
          description: activity.description,
          url: activity.url,
          project: activity.project,
          repository: activity.repository,
          branch: activity.branch,
          commitSha: activity.commitSha,
          mrNumber: activity.mrNumber,
          issueNumber: activity.issueNumber,
          pipelineId: activity.pipelineId,
          environment: activity.environment,
          timestamp: activity.timestamp,
          rawPayload: activity.rawPayload as Prisma.InputJsonValue,
        },
      });
      inserted += 1;

      if (!lastEventAt || activity.timestamp > lastEventAt) {
        lastEventAt = activity.timestamp;
        lastEventId = activity.gitlabEventId;
      }

      await processActivityPipeline(
        { ...activity, id: created.id, memberId: feed.memberId },
        config,
      );
    }

    await db.gitLabMemberFeed.update({
      where: { id: feed.id },
      data: {
        lastSuccessAt: now,
        lastHttpStatus: fetchResult.status,
        lastError: null,
        parseError: null,
        lastEventAt: lastEventAt ?? feed.lastEventAt,
        lastEventId: lastEventId ?? feed.lastEventId,
      },
    });

    return { memberId, fetched: true, inserted, skipped, error: null };
  }

  async ingestAllActiveFeeds(): Promise<FeedIngestionResult[]> {
    const feeds = await db.gitLabMemberFeed.findMany({
      where: { isEnabled: true },
      select: { memberId: true },
    });

    const results: FeedIngestionResult[] = [];
    for (const feed of feeds) {
      try {
        results.push(await this.ingestMemberFeed(feed.memberId));
      } catch (error) {
        logger.error("Feed ingestion failed", {
          memberId: feed.memberId,
          error,
        });
        results.push({
          memberId: feed.memberId,
          fetched: false,
          inserted: 0,
          skipped: 0,
          error: error instanceof Error ? error.message : "Ingestion failed",
        });
      }
    }
    return results;
  }
}

export const feedIngestionService = new FeedIngestionService();
