import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  mode: z.enum(["ANALYZE", "APPLY"]).optional(),
  status: z
    .enum([
      "PENDING",
      "QUEUED",
      "RUNNING",
      "COMPLETED",
      "PARTIAL",
      "FAILED",
      "CANCELLED",
      "STALE",
      "REJECTED",
    ])
    .optional(),
  triggerType: z
    .enum([
      "MANUAL",
      "SCHEDULED_PERIODIC",
      "SPRINT_START",
      "DURING_SPRINT",
      "SPRINT_END",
      "RETRY",
      "POST_SPRINT_RECONCILIATION",
    ])
    .optional(),
  milestoneId: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const result = await sprintIntelligenceQueryService.listRuns(query);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
