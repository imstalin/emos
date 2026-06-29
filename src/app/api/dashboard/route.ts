import { NextResponse } from "next/server";

import { dashboardService } from "@/server/services/dashboard/dashboard.service";

export async function GET() {
  const metrics = await dashboardService.getMetrics();
  return NextResponse.json(metrics);
}
