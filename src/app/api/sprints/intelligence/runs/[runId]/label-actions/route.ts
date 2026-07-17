import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  action: z.enum(["ADD", "REMOVE"]).optional(),
  status: z
    .enum([
      "PLANNED",
      "APPLIED",
      "SKIPPED",
      "NOOP",
      "FAILED",
      "REJECTED",
    ])
    .optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const result = await sprintIntelligenceQueryService.listLabelActions(
      runId,
      query,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
