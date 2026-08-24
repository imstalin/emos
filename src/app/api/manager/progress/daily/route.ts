import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const dashboard = await managerProgressService.getDashboard({ date });
  return NextResponse.json(dashboard.summary);
}
