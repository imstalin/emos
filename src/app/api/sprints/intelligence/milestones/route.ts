import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

export async function GET() {
  try {
    const data = await sprintIntelligenceQueryService.listMilestones();
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
