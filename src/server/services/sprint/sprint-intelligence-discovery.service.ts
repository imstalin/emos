import type { Sprint, SprintEvaluationTrigger } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getSprintIntelligenceEnvConfig,
  resolveEffectiveSprintIntelligenceConfig,
} from "@/lib/sprint-intelligence-config";
import { getMonitoredGitLabProjectIds } from "@/lib/gitlab-config";
import { sprintEvaluationRunRepository } from "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository";
import { endOfDayInTimeZone, startOfDayInTimeZone } from "@/domain/sprint-intelligence";

import { createSprintIntelligenceExecutionService } from "./sprint-intelligence-execution.service";
import { enqueueSprintIntelligenceAnalyze } from "@/server/queues/sprint-intelligence.queue";

export type DiscoveryEnqueueResult = {
  milestoneId: number;
  triggerType: SprintEvaluationTrigger;
  runId: string;
  reused: boolean;
};

/**
 * Periodic discovery: finds due lifecycle analyses and enqueues them.
 * Never enqueues apply jobs (scheduled runs are analyze-only by default).
 */
export class SprintIntelligenceDiscoveryService {
  async discoverAndEnqueue(now = new Date()): Promise<{
    inspected: number;
    enqueued: DiscoveryEnqueueResult[];
    skipped: Array<{ milestoneId: number; reason: string }>;
  }> {
    const env = getSprintIntelligenceEnvConfig();
    logger.info("sprint-intelligence.discovery.started", {
      discoveryEnabled: env.discoveryEnabled,
      enabled: env.enabled,
    });

    if (!env.enabled || !env.discoveryEnabled) {
      logger.info("sprint-intelligence.discovery.completed", {
        inspected: 0,
        enqueued: 0,
        reason: "disabled",
      });
      return { inspected: 0, enqueued: [], skipped: [] };
    }

    const effective = resolveEffectiveSprintIntelligenceConfig();
    const sprints = await db.sprint.findMany({
      where: {
        gitlabMilestoneId: { not: null },
        OR: [
          { isActive: true },
          {
            endDate: {
              gte: new Date(
                now.getTime() -
                  effective.postSprintReconciliationHours * 60 * 60_000,
              ),
            },
          },
        ],
      },
      orderBy: { startDate: "asc" },
    });

    const projectIds =
      getMonitoredGitLabProjectIds() ??
      (
        await db.gitLabProject.findMany({
          select: { gitlabId: true },
          take: 100,
        })
      )
        .map((project) => project.gitlabId)
        .filter((id): id is number => Number.isFinite(id));

    const execution = createSprintIntelligenceExecutionService();
    if (!execution) {
      throw new Error("GitLab is not configured");
    }

    const enqueued: DiscoveryEnqueueResult[] = [];
    const skipped: Array<{ milestoneId: number; reason: string }> = [];

    for (const sprint of sprints) {
      if (sprint.gitlabMilestoneId == null) continue;

      const dueTriggers = determineDueTriggers(sprint, now, effective);
      for (const triggerType of dueTriggers) {
        if (triggerType !== "DURING_SPRINT") {
          const existing = await sprintEvaluationRunRepository.findLifecycleRun({
            milestoneId: sprint.gitlabMilestoneId,
            triggerType,
          });
          if (existing) {
            skipped.push({
              milestoneId: sprint.gitlabMilestoneId,
              reason: `${triggerType}_already_exists`,
            });
            continue;
          }
        } else {
          const latest =
            await sprintEvaluationRunRepository.findLatestDuringSprintRun(
              sprint.gitlabMilestoneId,
            );
          if (
            latest?.completedAt &&
            now.getTime() - latest.completedAt.getTime() <
              effective.duringSprintIntervalMinutes * 60_000
          ) {
            skipped.push({
              milestoneId: sprint.gitlabMilestoneId,
              reason: "during_sprint_interval_not_due",
            });
            continue;
          }
          if (
            latest &&
            (latest.status === "PENDING" ||
              latest.status === "QUEUED" ||
              latest.status === "RUNNING")
          ) {
            skipped.push({
              milestoneId: sprint.gitlabMilestoneId,
              reason: "during_sprint_in_flight",
            });
            continue;
          }
        }

        const startDate = formatDate(sprint.startDate);
        const dueDate = formatDate(sprint.endDate);

        const evaluationWindow =
          triggerType === "DURING_SPRINT"
            ? `hour:${new Date(
                Math.floor(now.getTime() / (effective.duringSprintIntervalMinutes * 60_000)) *
                  effective.duringSprintIntervalMinutes *
                  60_000,
              ).toISOString()}`
            : undefined;

        const requested = await execution.requestAnalysis({
          projectIds,
          milestone: {
            id: sprint.gitlabMilestoneId,
            title: sprint.name,
            startDate,
            dueDate,
          },
          triggerType,
          evaluationWindow,
        });

        if (!requested.reused || requested.status === "PENDING") {
          await enqueueSprintIntelligenceAnalyze(requested.runId);
        }

        enqueued.push({
          milestoneId: sprint.gitlabMilestoneId,
          triggerType,
          runId: requested.runId,
          reused: requested.reused,
        });

        logger.info("sprint-intelligence.discovery.enqueued", {
          runId: requested.runId,
          milestoneId: sprint.gitlabMilestoneId,
          triggerType,
          reused: requested.reused,
        });
      }
    }

    logger.info("sprint-intelligence.discovery.completed", {
      inspected: sprints.length,
      enqueued: enqueued.length,
      skipped: skipped.length,
    });

    return { inspected: sprints.length, enqueued, skipped };
  }
}

export function determineDueTriggers(
  sprint: Sprint,
  now: Date,
  effective: ReturnType<typeof resolveEffectiveSprintIntelligenceConfig>,
): SprintEvaluationTrigger[] {
  const timezone = effective.ruleConfig.timezone;
  const startYmd = formatDate(sprint.startDate);
  const endYmd = formatDate(sprint.endDate);
  const planningBoundary = effective.ruleConfig.allowFirstDayAdditions
    ? endOfDayInTimeZone(startYmd, timezone)
    : startOfDayInTimeZone(startYmd, timezone);
  const sprintEnd = endOfDayInTimeZone(endYmd, timezone);
  if (!planningBoundary || !sprintEnd) return [];

  const due: SprintEvaluationTrigger[] = [];

  if (now.getTime() >= planningBoundary.getTime()) {
    due.push("SPRINT_START");
  }

  if (
    now.getTime() >= planningBoundary.getTime() &&
    now.getTime() <= sprintEnd.getTime()
  ) {
    due.push("DURING_SPRINT");
  }

  if (now.getTime() > sprintEnd.getTime()) {
    due.push("SPRINT_END");
    const reconciliationAt =
      sprintEnd.getTime() +
      effective.postSprintReconciliationHours * 60 * 60_000;
    if (
      effective.postSprintReconciliationHours > 0 &&
      now.getTime() >= reconciliationAt
    ) {
      due.push("POST_SPRINT_RECONCILIATION");
    }
  }

  return due;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const sprintIntelligenceDiscoveryService =
  new SprintIntelligenceDiscoveryService();
