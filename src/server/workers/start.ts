import "dotenv/config";

import { getGitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import { getSyncIntervalMinutes } from "@/lib/sync-config";
import { getManagerProgressFeedIntervalMinutes } from "@/lib/manager-progress-config";
import { getSprintIntelligenceEnvConfig } from "@/lib/sprint-intelligence-config";
import {
  closeGitLabSyncQueue,
  scheduleGitLabSync,
} from "@/server/queues/gitlab-sync.queue";
import {
  closeSprintIntelligenceQueue,
  scheduleSprintIntelligenceDiscovery,
} from "@/server/queues/sprint-intelligence.queue";
import { createGitLabSyncWorker } from "@/server/workers/gitlab-sync.worker";
import { createSprintIntelligenceWorker } from "@/server/workers/sprint-intelligence.worker";
import {
  closeManagerProgressQueue,
  scheduleManagerProgressFeedIngestion,
} from "@/server/queues/manager-progress-feed.queue";
import { createManagerProgressFeedWorker } from "@/server/workers/manager-progress-feed.worker";
import { isManagerProgressEnabled } from "@/lib/manager-progress-config";

async function main() {
  if (!getGitLabConfig()) {
    logger.error(
      "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
    );
    process.exit(1);
  }

  const gitlabWorker = createGitLabSyncWorker();
  await scheduleGitLabSync();

  logger.info("GitLab sync worker started", {
    intervalMinutes: getSyncIntervalMinutes(),
  });

  const sprintEnv = getSprintIntelligenceEnvConfig();
  const sprintWorker = createSprintIntelligenceWorker();
  await scheduleSprintIntelligenceDiscovery();

  logger.info("sprint-intelligence.worker.started", {
    enabled: sprintEnv.enabled,
    discoveryEnabled: sprintEnv.discoveryEnabled,
    dryRunOnly: sprintEnv.dryRunOnly,
    concurrency: sprintEnv.workerConcurrency,
  });

  let managerProgressWorker: ReturnType<typeof createManagerProgressFeedWorker> | null =
    null;
  if (isManagerProgressEnabled()) {
    managerProgressWorker = createManagerProgressFeedWorker();
    await scheduleManagerProgressFeedIngestion();
    logger.info("Manager progress feed worker started", {
      intervalMinutes: getManagerProgressFeedIntervalMinutes(),
    });
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down workers`);
    await gitlabWorker.close();
    await sprintWorker.close();
    if (managerProgressWorker) await managerProgressWorker.close();
    await closeGitLabSyncQueue();
    await closeSprintIntelligenceQueue();
    await closeManagerProgressQueue();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
