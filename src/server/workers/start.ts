import "dotenv/config";

import { getGitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import { getSyncIntervalMinutes } from "@/lib/sync-config";
import {
  closeGitLabSyncQueue,
  scheduleGitLabSync,
} from "@/server/queues/gitlab-sync.queue";
import { createGitLabSyncWorker } from "@/server/workers/gitlab-sync.worker";

async function main() {
  if (!getGitLabConfig()) {
    logger.error(
      "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
    );
    process.exit(1);
  }

  const worker = createGitLabSyncWorker();
  await scheduleGitLabSync();

  logger.info("GitLab sync worker started", {
    intervalMinutes: getSyncIntervalMinutes(),
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down worker`);
    await worker.close();
    await closeGitLabSyncQueue();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
