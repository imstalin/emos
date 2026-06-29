import { NextResponse } from "next/server";

import { releasesService } from "@/server/services/releases/releases.service";

export async function GET() {
  const data = await releasesService.getDashboard();
  return NextResponse.json(data);
}
