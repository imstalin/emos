import { Worker, type Job } from "bullmq";

import { createRedisConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  MANAGER_PROGRESS_JOB_NAME,
  MANAGER_PROGRESS_QUEUE_NAME,
  type ManagerProgressJobData,
} from "@/lib/manager-progress-config";
import { feedIngestionService } from "@/server/services/manager-progress/feed-ingestion.service";

export type ManagerProgressJobResult = {
  results: Awaited<ReturnType<typeof feedIngestionService.ingestAllActiveFeeds>>;
};

export function createManagerProgressFeedWorker() {
  const worker = new Worker<ManagerProgressJobData, ManagerProgressJobResult>(
    MANAGER_PROGRESS_QUEUE_NAME,
    async (job: Job<ManagerProgressJobData, ManagerProgressJobResult>) => {
      logger.info("Processing manager progress feed job", {
        jobId: job.id,
        trigger: job.data.trigger,
        memberId: job.data.memberId,
      });

      if (job.data.memberId) {
        const result = await feedIngestionService.ingestMemberFeed(
          job.data.memberId,
        );
        return { results: [result] };
      }

      const results = await feedIngestionService.ingestAllActiveFeeds();
      return { results };
    },
    {
      connection: createRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job, result) => {
    const inserted = result.results.reduce((sum, r) => sum + r.inserted, 0);
    logger.info("Manager progress feed job completed", {
      jobId: job.id,
      feedsProcessed: result.results.length,
      activitiesInserted: inserted,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Manager progress feed job failed", {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
}

export { MANAGER_PROGRESS_JOB_NAME };
