import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

export async function GET() {
  try {
    const status = await sprintIntelligenceQueryService.getStatusWithWorker();
    return NextResponse.json(status);
  } catch (error) {
    return handleRouteError(error);
  }
}
