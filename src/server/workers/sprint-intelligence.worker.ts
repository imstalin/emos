import { UnrecoverableError, Worker, type Job } from "bullmq";

import { createRedisConnection } from "@/lib/redis";
import {
  getSprintIntelligenceEnvConfig,
  SPRINT_INTELLIGENCE_QUEUE_NAME,
} from "@/lib/sprint-intelligence-config";
import { logger } from "@/lib/logger";
import type { SprintIntelligenceJobData } from "@/server/queues/sprint-intelligence.queue";
import { createSprintIntelligenceExecutionService } from "@/server/services/sprint/sprint-intelligence-execution.service";
import { sprintIntelligenceDiscoveryService } from "@/server/services/sprint/sprint-intelligence-discovery.service";
import { createSprintIntelligenceReconcileService } from "@/server/services/sprint/sprint-intelligence-reconcile.service";
import { sprintEvaluationRunRepository } from "@/server/repositories/sprint-intelligence/sprint-evaluation-run.repository";
import { sanitizeErrorMessage } from "@/server/services/sprint/sprint-intelligence-hash";

const UNRECOVERABLE_PREFIXES = [
  "FEATURE_DISABLED",
  "DRY_RUN_ONLY",
  "CONFIRMATION_REQUIRED",
  "SOURCE_ANALYSIS_INVALID",
  "STALE_ANALYSIS",
  "ANALYSIS_ALREADY_CONSUMED",
  "HASH_MISMATCH",
  "INVALID_MODE",
  "INVALID_RUN_TRANSITION",
  "RUN_NOT_FOUND",
];

function isUnrecoverable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNRECOVERABLE_PREFIXES.some((prefix) => message.startsWith(prefix));
}

export function createSprintIntelligenceWorker() {
  const env = getSprintIntelligenceEnvConfig();

  const worker = new Worker<SprintIntelligenceJobData>(
    SPRINT_INTELLIGENCE_QUEUE_NAME,
    async (job: Job<SprintIntelligenceJobData>) => {
      const data = job.data;
      logger.info("sprint-intelligence.worker.started", {
        jobId: job.id,
        type: data.type,
      });

      try {
        switch (data.type) {
          case "analyze": {
            const service = createSprintIntelligenceExecutionService();
            if (!service) {
              throw new UnrecoverableError("GitLab is not configured");
            }
            return service.executeAnalysisRun(data.runId);
          }
          case "apply": {
            const service = createSprintIntelligenceExecutionService();
            if (!service) {
              throw new UnrecoverableError("GitLab is not configured");
            }
            return service.executeApplyRun(data.runId);
          }
          case "discover": {
            return sprintIntelligenceDiscoveryService.discoverAndEnqueue();
          }
          case "reconcile": {
            const service = createSprintIntelligenceReconcileService();
            if (!service) {
              throw new UnrecoverableError("GitLab is not configured");
            }
            return service.reconcile({ projectId: data.projectId });
          }
          default: {
            throw new UnrecoverableError(
              `Unknown sprint-intelligence job type: ${JSON.stringify(data)}`,
            );
          }
        }
      } catch (error) {
        if (isUnrecoverable(error)) {
          if (
            (data.type === "analyze" || data.type === "apply") &&
            "runId" in data
          ) {
            try {
              await sprintEvaluationRunRepository.rejectRun(
                data.runId,
                "UNRECOVERABLE",
                sanitizeErrorMessage(
                  error instanceof Error ? error.message : "Rejected",
                ) ?? "Rejected",
              );
            } catch {
              // ignore secondary persistence errors
            }
          }
          throw new UnrecoverableError(
            error instanceof Error ? error.message : String(error),
          );
        }
        throw error;
      }
    },
    {
      connection: createRedisConnection() as never,
      concurrency: env.workerConcurrency,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error("sprint-intelligence.worker.job-failed", {
      jobId: job?.id,
      type: job?.data?.type,
      error: error.message,
    });

    const data = job?.data;
    if (
      job &&
      (data?.type === "analyze" || data?.type === "apply") &&
      job.attemptsMade >= (job.opts.attempts ?? 1)
    ) {
      void sprintEvaluationRunRepository
        .completeRun(data.runId, {
          status: "FAILED",
          errorCode: "JOB_FAILED",
          errorMessage: sanitizeErrorMessage(error.message),
        })
        .catch(() => undefined);
    }
  });

  worker.on("closed", () => {
    logger.info("sprint-intelligence.worker.stopped");
  });

  return worker;
}
