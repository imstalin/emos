import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

export async function GET() {
  try {
    const config = sprintIntelligenceQueryService.getEffectiveConfig();
    return NextResponse.json(config);
  } catch (error) {
    return handleRouteError(error);
  }
}
