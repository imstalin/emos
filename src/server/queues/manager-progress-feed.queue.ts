import { Queue } from "bullmq";

import { createRedisConnection } from "@/lib/redis";
import {
  getManagerProgressFeedIntervalMinutes,
  MANAGER_PROGRESS_JOB_NAME,
  MANAGER_PROGRESS_QUEUE_NAME,
  MANAGER_PROGRESS_SCHEDULER_ID,
  type ManagerProgressJobData,
} from "@/lib/manager-progress-config";

let queueInstance: Queue | null = null;

export function getManagerProgressQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(MANAGER_PROGRESS_QUEUE_NAME, {
      connection: createRedisConnection(),
    });
  }
  return queueInstance;
}

export async function scheduleManagerProgressFeedIngestion(): Promise<void> {
  const queue = getManagerProgressQueue();
  const intervalMs = getManagerProgressFeedIntervalMinutes() * 60 * 1000;

  await queue.upsertJobScheduler(
    MANAGER_PROGRESS_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: MANAGER_PROGRESS_JOB_NAME,
      data: { trigger: "scheduled" },
      opts: {
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    },
  );
}

export async function enqueueManagerProgressIngestion(
  memberId?: string,
): Promise<string | undefined> {
  const queue = getManagerProgressQueue();
  const job = await queue.add(
    MANAGER_PROGRESS_JOB_NAME,
    { trigger: "manual", memberId },
    {
      removeOnComplete: 50,
      removeOnFail: 25,
    },
  );
  return job.id;
}

export async function closeManagerProgressQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
