import type { SprintIssueEvaluation } from "@prisma/client";

import { db } from "@/lib/db";

export type CreateIssueEvaluationInput = {
  runId: string;
  projectId: number;
  issueId: number;
  issueIid: number;
  issueTitle: string;
  milestoneId: number;
  milestoneTitle: string;
  assignmentTimestamp?: Date | null;
  removalTimestamp?: Date | null;
  completionTimestamp?: Date | null;
  planningStatus: string;
  deliveryStatus: string;
  workTypes: string[];
  excludedFromCommitment: boolean;
  completedWithinSprint: boolean;
  existingLabels: string[];
  recommendedLabelsToAdd: string[];
  recommendedManagedLabelsToRemove: string[];
  reasonCodes: string[];
  eventResolutionDetails?: object;
  evaluationErrorCode?: string | null;
  evaluationErrorMessage?: string | null;
};

export class SprintIssueEvaluationRepository {
  async createManyForRun(
    items: CreateIssueEvaluationInput[],
  ): Promise<SprintIssueEvaluation[]> {
    if (items.length === 0) return [];

    await db.sprintIssueEvaluation.createMany({
      data: items.map((item) => ({
        runId: item.runId,
        projectId: item.projectId,
        issueId: item.issueId,
        issueIid: item.issueIid,
        issueTitle: item.issueTitle,
        milestoneId: item.milestoneId,
        milestoneTitle: item.milestoneTitle,
        assignmentTimestamp: item.assignmentTimestamp ?? null,
        removalTimestamp: item.removalTimestamp ?? null,
        completionTimestamp: item.completionTimestamp ?? null,
        planningStatus: item.planningStatus,
        deliveryStatus: item.deliveryStatus,
        workTypes: item.workTypes,
        excludedFromCommitment: item.excludedFromCommitment,
        completedWithinSprint: item.completedWithinSprint,
        existingLabels: item.existingLabels,
        recommendedLabelsToAdd: item.recommendedLabelsToAdd,
        recommendedManagedLabelsToRemove:
          item.recommendedManagedLabelsToRemove,
        reasonCodes: item.reasonCodes,
        eventResolutionDetails: item.eventResolutionDetails ?? {},
        evaluationErrorCode: item.evaluationErrorCode ?? null,
        evaluationErrorMessage: item.evaluationErrorMessage ?? null,
      })),
      skipDuplicates: true,
    });

    return this.listByRun(items[0]!.runId);
  }

  async listByRun(runId: string): Promise<SprintIssueEvaluation[]> {
    return db.sprintIssueEvaluation.findMany({
      where: { runId },
      orderBy: [{ projectId: "asc" }, { issueIid: "asc" }],
    });
  }

  async getIssueEvaluation(
    runId: string,
    projectId: number,
    issueIid: number,
  ): Promise<SprintIssueEvaluation | null> {
    return db.sprintIssueEvaluation.findUnique({
      where: {
        runId_projectId_issueIid: { runId, projectId, issueIid },
      },
    });
  }
}

export const sprintIssueEvaluationRepository =
  new SprintIssueEvaluationRepository();
