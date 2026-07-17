import type {
  Prisma,
  SprintEvaluationRun,
  SprintEvaluationRunMode,
  SprintEvaluationRunStatus,
  SprintEvaluationTrigger,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  assertSprintRunTransition,
  isSuccessfulAnalysisStatus,
} from "@/server/services/sprint/sprint-intelligence-run-state";

export type CreatePendingRunInput = {
  runKey: string;
  correlationId: string;
  mode: SprintEvaluationRunMode;
  triggerType: SprintEvaluationTrigger;
  projectIds: number[];
  milestoneId: number;
  milestoneTitle: string;
  milestoneStartDate?: string | null;
  milestoneDueDate?: string | null;
  timezone: string;
  ruleConfigSnapshot: Prisma.InputJsonValue;
  inputHash?: string | null;
  dryRun: boolean;
  confirmationRequired?: boolean;
  sourceAnalysisRunId?: string | null;
  requestedBy?: string | null;
  automationVersion: string;
};

export class SprintEvaluationRunRepository {
  async createPendingRun(
    input: CreatePendingRunInput,
  ): Promise<SprintEvaluationRun> {
    return db.sprintEvaluationRun.create({
      data: {
        runKey: input.runKey,
        correlationId: input.correlationId,
        mode: input.mode,
        status: "PENDING",
        triggerType: input.triggerType,
        projectIds: input.projectIds,
        milestoneId: input.milestoneId,
        milestoneTitle: input.milestoneTitle,
        milestoneStartDate: input.milestoneStartDate ?? null,
        milestoneDueDate: input.milestoneDueDate ?? null,
        timezone: input.timezone,
        ruleConfigSnapshot: input.ruleConfigSnapshot,
        inputHash: input.inputHash ?? null,
        dryRun: input.dryRun,
        confirmationRequired: input.confirmationRequired ?? false,
        sourceAnalysisRunId: input.sourceAnalysisRunId ?? null,
        requestedBy: input.requestedBy ?? null,
        automationVersion: input.automationVersion,
      },
    });
  }

  async getById(id: string): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findUnique({ where: { id } });
  }

  async getByRunKey(runKey: string): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findUnique({ where: { runKey } });
  }

  async findActiveRun(runKey: string): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findFirst({
      where: {
        runKey,
        status: { in: ["PENDING", "QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find an in-flight run whose key equals or starts with the deterministic base key
   * (covers `:attempt:` suffixes used after failed retries).
   */
  async findActiveRunByKeyPrefix(
    baseRunKey: string,
  ): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findFirst({
      where: {
        OR: [
          { runKey: baseRunKey },
          { runKey: { startsWith: `${baseRunKey}:attempt:` } },
        ],
        status: { in: ["PENDING", "QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findSuccessfulApplyForSource(
    sourceAnalysisRunId: string,
  ): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findFirst({
      where: {
        mode: "APPLY",
        sourceAnalysisRunId,
        status: { in: ["COMPLETED", "PARTIAL"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSourceAnalysisForApply(
    sourceAnalysisRunId: string,
  ): Promise<SprintEvaluationRun | null> {
    const run = await this.getById(sourceAnalysisRunId);
    if (!run || run.mode !== "ANALYZE") return null;
    if (!isSuccessfulAnalysisStatus(run.status)) return null;
    return run;
  }

  async transition(
    id: string,
    to: SprintEvaluationRunStatus,
    data: Prisma.SprintEvaluationRunUpdateInput = {},
  ): Promise<SprintEvaluationRun> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`RUN_NOT_FOUND: ${id}`);
    }
    assertSprintRunTransition(current.status, to);

    return db.sprintEvaluationRun.update({
      where: { id },
      data: {
        ...data,
        status: to,
      },
    });
  }

  async markQueued(id: string, jobId: string): Promise<SprintEvaluationRun> {
    return this.transition(id, "QUEUED", { jobId });
  }

  async markRunning(id: string): Promise<SprintEvaluationRun> {
    return this.transition(id, "RUNNING", { startedAt: new Date() });
  }

  async completeRun(
    id: string,
    data: {
      status: "COMPLETED" | "PARTIAL" | "FAILED" | "REJECTED" | "STALE";
      summary?: Prisma.InputJsonValue;
      metrics?: Prisma.InputJsonValue;
      analysisHash?: string | null;
      inputHash?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<SprintEvaluationRun> {
    return this.transition(id, data.status, {
      completedAt: new Date(),
      summary: data.summary,
      metrics: data.metrics,
      analysisHash: data.analysisHash,
      inputHash: data.inputHash,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    });
  }

  async rejectRun(
    id: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<SprintEvaluationRun> {
    return this.completeRun(id, {
      status: "REJECTED",
      errorCode,
      errorMessage,
    });
  }

  async findLifecycleRun(params: {
    milestoneId: number;
    triggerType: SprintEvaluationTrigger;
    statuses?: SprintEvaluationRunStatus[];
  }): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findFirst({
      where: {
        milestoneId: params.milestoneId,
        triggerType: params.triggerType,
        mode: "ANALYZE",
        status: {
          in: params.statuses ?? [
            "PENDING",
            "QUEUED",
            "RUNNING",
            "COMPLETED",
            "PARTIAL",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findLatestDuringSprintRun(
    milestoneId: number,
  ): Promise<SprintEvaluationRun | null> {
    return db.sprintEvaluationRun.findFirst({
      where: {
        milestoneId,
        triggerType: "DURING_SPRINT",
        mode: "ANALYZE",
        status: { in: ["COMPLETED", "PARTIAL", "RUNNING", "QUEUED", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const sprintEvaluationRunRepository =
  new SprintEvaluationRunRepository();
