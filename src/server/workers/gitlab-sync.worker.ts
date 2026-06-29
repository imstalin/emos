import { Worker, type Job } from "bullmq";

import type { GitLabSyncJobData } from "@/lib/sync-config";
import { createRedisConnection } from "@/lib/redis";
import {
  GITLAB_SYNC_JOB_NAME,
  GITLAB_SYNC_QUEUE_NAME,
} from "@/lib/sync-config";
import { logger } from "@/lib/logger";
import type { SyncResult } from "@/domain/types/gitlab";
import { createGitLabSyncService } from "@/server/services/gitlab/gitlab-sync.service";

export function createGitLabSyncWorker() {
  const worker = new Worker<GitLabSyncJobData, SyncResult>(
    GITLAB_SYNC_QUEUE_NAME,
    async (job: Job<GitLabSyncJobData, SyncResult>) => {
      logger.info("Processing GitLab sync job", {
        jobId: job.id,
        trigger: job.data.trigger,
        projectId: job.data.projectId,
      });

      const service = createGitLabSyncService();
      if (!service) {
        throw new Error("GitLab is not configured");
      }

      if (job.data.projectId != null) {
        return service.syncProject(job.data.projectId);
      }

      return service.syncAll();
    },
    {
      connection: createRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job, result) => {
    logger.info("GitLab sync job completed", {
      jobId: job.id,
      itemsSynced: result.itemsSynced,
      itemsClosed: result.itemsClosed,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("GitLab sync job failed", {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
}

export { GITLAB_SYNC_JOB_NAME };
