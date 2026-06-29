import { NextResponse } from "next/server";

import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";

export async function GET() {
  const data = await followUpsService.getDashboard();
  return NextResponse.json(data);
}
