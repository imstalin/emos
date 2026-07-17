import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  planningStatus: z
    .enum(["Planned", "Unplanned", "UnableToDetermine", "NotApplicable"])
    .optional(),
  deliveryStatus: z
    .enum([
      "Committed",
      "Spillover",
      "CompletedUnplanned",
      "OpenUnplanned",
      "Excluded",
      "UnableToDetermine",
      "NotApplicable",
    ])
    .optional(),
  workType: z
    .enum([
      "Regression",
      "Bug",
      "Enhancement",
      "Support",
      "Hotfix",
      "TechnicalDebt",
      "UAT",
      "ReleaseValidation",
      "Deployment",
      "Unknown",
    ])
    .optional(),
  state: z.enum(["opened", "closed"]).optional(),
  excludedFromCommitment: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  hasRecommendedChanges: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  hasEvaluationError: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  existingLabel: z.string().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum([
      "issueIid",
      "title",
      "issueTitle",
      "projectName",
      "planningStatus",
      "deliveryStatus",
      "milestoneAssignedAt",
      "assignmentTimestamp",
      "completedAt",
      "completionTimestamp",
      "evaluationStatus",
    ])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const result = await sprintIntelligenceQueryService.listIssues(runId, query);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
