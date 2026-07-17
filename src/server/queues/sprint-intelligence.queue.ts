import { Queue } from "bullmq";

import { createRedisConnection } from "@/lib/redis";
import {
  getSprintIntelligenceEnvConfig,
  SPRINT_INTELLIGENCE_ANALYZE_JOB,
  SPRINT_INTELLIGENCE_APPLY_JOB,
  SPRINT_INTELLIGENCE_DISCOVER_JOB,
  SPRINT_INTELLIGENCE_DISCOVERY_SCHEDULER_ID,
  SPRINT_INTELLIGENCE_QUEUE_NAME,
  SPRINT_INTELLIGENCE_RECONCILE_JOB,
} from "@/lib/sprint-intelligence-config";
import { logger } from "@/lib/logger";
import { sprintEvaluationRunRepository } from "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository";

export type SprintIntelligenceJobData =
  | { type: "analyze"; runId: string }
  | { type: "apply"; runId: string }
  | { type: "discover"; requestedAt: string }
  | { type: "reconcile"; projectId?: number };

// BullMQ/ioredis typings diverge across package versions in this repo.
let queueInstance: Queue | null = null;

export function getSprintIntelligenceQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(SPRINT_INTELLIGENCE_QUEUE_NAME, {
      connection: createRedisConnection() as never,
    });
  }
  return queueInstance;
}

function jobOpts() {
  const env = getSprintIntelligenceEnvConfig();
  return {
    attempts: env.jobAttempts,
    backoff: {
      type: "exponential" as const,
      delay: env.jobBackoffMs,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  };
}

export async function enqueueSprintIntelligenceAnalyze(
  runId: string,
): Promise<string | undefined> {
  const queue = getSprintIntelligenceQueue();
  const job = await queue.add(
    SPRINT_INTELLIGENCE_ANALYZE_JOB,
    { type: "analyze", runId },
    {
      ...jobOpts(),
      jobId: `analyze-${runId}`,
    },
  );

  await sprintEvaluationRunRepository.markQueued(runId, String(job.id));
  logger.info("sprint-intelligence.run.queued", {
    runId,
    jobId: job.id,
    type: "analyze",
  });
  return job.id;
}

export async function enqueueSprintIntelligenceApply(
  runId: string,
): Promise<string | undefined> {
  const queue = getSprintIntelligenceQueue();
  const job = await queue.add(
    SPRINT_INTELLIGENCE_APPLY_JOB,
    { type: "apply", runId },
    {
      ...jobOpts(),
      jobId: `apply-${runId}`,
    },
  );

  await sprintEvaluationRunRepository.markQueued(runId, String(job.id));
  logger.info("sprint-intelligence.run.queued", {
    runId,
    jobId: job.id,
    type: "apply",
  });
  return job.id;
}

export async function enqueueSprintIntelligenceDiscover(): Promise<
  string | undefined
> {
  const queue = getSprintIntelligenceQueue();
  const job = await queue.add(
    SPRINT_INTELLIGENCE_DISCOVER_JOB,
    { type: "discover", requestedAt: new Date().toISOString() },
    {
      ...jobOpts(),
      jobId: `discover-${Math.floor(Date.now() / 60_000)}`,
    },
  );
  return job.id;
}

export async function enqueueSprintIntelligenceReconcile(
  projectId?: number,
): Promise<string | undefined> {
  const queue = getSprintIntelligenceQueue();
  const job = await queue.add(
    SPRINT_INTELLIGENCE_RECONCILE_JOB,
    { type: "reconcile", projectId },
    jobOpts(),
  );
  return job.id;
}

export async function scheduleSprintIntelligenceDiscovery(): Promise<void> {
  const env = getSprintIntelligenceEnvConfig();
  if (!env.enabled || !env.discoveryEnabled) {
    return;
  }

  const queue = getSprintIntelligenceQueue();
  const intervalMs = env.discoveryIntervalMinutes * 60 * 1000;

  await queue.upsertJobScheduler(
    SPRINT_INTELLIGENCE_DISCOVERY_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: SPRINT_INTELLIGENCE_DISCOVER_JOB,
      data: { type: "discover", requestedAt: new Date().toISOString() },
      opts: jobOpts(),
    },
  );

  logger.info("sprint-intelligence.discovery.started", {
    scheduled: true,
    intervalMinutes: env.discoveryIntervalMinutes,
  });
}

export async function closeSprintIntelligenceQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
