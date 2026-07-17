import type {
  SprintLabelAction,
  SprintLabelActionStatus,
  SprintLabelActionType,
} from "@prisma/client";

import { db } from "@/lib/db";

export type CreatePlannedLabelActionInput = {
  runId: string;
  issueEvaluationId?: string | null;
  projectId: number;
  issueIid: number;
  label: string;
  action: SprintLabelActionType;
  ownedBefore?: boolean;
};

export class SprintLabelActionRepository {
  async createPlannedActions(
    items: CreatePlannedLabelActionInput[],
  ): Promise<SprintLabelAction[]> {
    if (items.length === 0) return [];

    await db.sprintLabelAction.createMany({
      data: items.map((item) => ({
        runId: item.runId,
        issueEvaluationId: item.issueEvaluationId ?? null,
        projectId: item.projectId,
        issueIid: item.issueIid,
        label: item.label,
        action: item.action,
        status: "PLANNED",
        ownedBefore: item.ownedBefore ?? false,
      })),
    });

    return this.listByRun(items[0]!.runId);
  }

  async listByRun(runId: string): Promise<SprintLabelAction[]> {
    return db.sprintLabelAction.findMany({
      where: { runId },
      orderBy: [{ projectId: "asc" }, { issueIid: "asc" }, { label: "asc" }],
    });
  }

  async updateStatus(
    id: string,
    status: SprintLabelActionStatus,
    data: {
      ownedAfter?: boolean | null;
      attemptedAt?: Date | null;
      completedAt?: Date | null;
      gitlabResponseStatus?: number | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    } = {},
  ): Promise<SprintLabelAction> {
    return db.sprintLabelAction.update({
      where: { id },
      data: {
        status,
        ownedAfter: data.ownedAfter,
        attemptedAt: data.attemptedAt,
        completedAt: data.completedAt,
        gitlabResponseStatus: data.gitlabResponseStatus,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      },
    });
  }

  async recordApplied(
    id: string,
    ownedAfter: boolean,
    gitlabResponseStatus?: number | null,
  ): Promise<SprintLabelAction> {
    return this.updateStatus(id, "APPLIED", {
      ownedAfter,
      attemptedAt: new Date(),
      completedAt: new Date(),
      gitlabResponseStatus: gitlabResponseStatus ?? 200,
    });
  }

  async recordSkipped(
    id: string,
    reason = "no_changes",
  ): Promise<SprintLabelAction> {
    return this.updateStatus(id, "SKIPPED", {
      attemptedAt: new Date(),
      completedAt: new Date(),
      errorCode: "SKIPPED",
      errorMessage: reason,
    });
  }

  async recordNoOp(id: string): Promise<SprintLabelAction> {
    return this.updateStatus(id, "NO_OP", {
      attemptedAt: new Date(),
      completedAt: new Date(),
    });
  }

  async recordFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
    gitlabResponseStatus?: number | null,
  ): Promise<SprintLabelAction> {
    return this.updateStatus(id, "FAILED", {
      attemptedAt: new Date(),
      completedAt: new Date(),
      errorCode,
      errorMessage,
      gitlabResponseStatus,
    });
  }
}

export const sprintLabelActionRepository = new SprintLabelActionRepository();
