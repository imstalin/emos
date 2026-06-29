import { NextResponse } from "next/server";

import { teamDashboardService } from "@/server/services/team/team-dashboard.service";

export async function GET() {
  const data = await teamDashboardService.getDashboard();
  return NextResponse.json(data);
}
