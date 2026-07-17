import { NextResponse } from "next/server";

import { apiError, handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string; evaluationId: string }> },
) {
  try {
    const { runId, evaluationId } = await context.params;
    const detail = await sprintIntelligenceQueryService.getIssueDetail(
      runId,
      evaluationId,
    );
    if (!detail) {
      return apiError(
        "EVALUATION_NOT_FOUND",
        "The requested issue evaluation was not found.",
        404,
      );
    }
    return NextResponse.json(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
