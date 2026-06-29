import { NextResponse } from "next/server";

import { phoenixKpiService } from "@/server/services/kpi/phoenix-kpi.service";

export async function GET() {
  const report = await phoenixKpiService.getMemberReport();
  return NextResponse.json(report);
}
