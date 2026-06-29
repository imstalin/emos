import { Queue } from "bullmq";

import type { GitLabSchedulerStatus } from "@/domain/types/gitlab";
import { createRedisConnection } from "@/lib/redis";
import {
  getSyncIntervalMinutes,
  GITLAB_SYNC_JOB_NAME,
  GITLAB_SYNC_QUEUE_NAME,
  GITLAB_SYNC_SCHEDULER_ID,
} from "@/lib/sync-config";

let queueInstance: Queue | null = null;

export function getGitLabSyncQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(GITLAB_SYNC_QUEUE_NAME, {
      connection: createRedisConnection(),
    });
  }

  return queueInstance;
}

export async function scheduleGitLabSync(): Promise<void> {
  const queue = getGitLabSyncQueue();
  const intervalMs = getSyncIntervalMinutes() * 60 * 1000;

  await queue.upsertJobScheduler(
    GITLAB_SYNC_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: GITLAB_SYNC_JOB_NAME,
      data: { trigger: "scheduled" },
      opts: {
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    },
  );
}

export async function getGitLabSchedulerStatus(): Promise<GitLabSchedulerStatus> {
  const intervalMinutes = getSyncIntervalMinutes();

  try {
    const queue = getGitLabSyncQueue();
    const [scheduler, waiting, active, isPaused] = await Promise.all([
      queue.getJobScheduler(GITLAB_SYNC_SCHEDULER_ID),
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.isPaused(),
    ]);

    const nextRunAt =
      scheduler?.next != null
        ? new Date(Number(scheduler.next)).toISOString()
        : null;

    return {
      redisAvailable: true,
      intervalMinutes,
      scheduled: scheduler != null,
      nextRunAt,
      queueWaiting: waiting,
      queueActive: active,
      queuePaused: isPaused,
    };
  } catch (error) {
    return {
      redisAvailable: false,
      intervalMinutes,
      scheduled: false,
      nextRunAt: null,
      queueWaiting: 0,
      queueActive: 0,
      queuePaused: false,
      error:
        error instanceof Error ? error.message : "Redis connection failed",
    };
  }
}

export async function enqueueGitLabProjectSync(
  gitlabProjectId: number,
): Promise<string | undefined> {
  const queue = getGitLabSyncQueue();
  const job = await queue.add(
    GITLAB_SYNC_JOB_NAME,
    { trigger: "webhook", projectId: gitlabProjectId },
    {
      jobId: `webhook-project-${gitlabProjectId}-${Math.floor(Date.now() / 10000)}`,
      delay: 5_000,
      removeOnComplete: 50,
      removeOnFail: 25,
    },
  );

  return job.id;
}

export async function closeGitLabSyncQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
