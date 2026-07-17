import { NextResponse } from "next/server";

import { apiError, handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const summary = await sprintIntelligenceQueryService.getRunSummary(runId);
    if (!summary) {
      return apiError(
        "RUN_NOT_FOUND",
        "The requested sprint analysis run was not found.",
        404,
      );
    }
    return NextResponse.json(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
