import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

export async function GET() {
  const trend = await managerProgressService.getWeeklyTrend();
  return NextResponse.json(trend);
}
