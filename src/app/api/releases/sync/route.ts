import { NextResponse } from "next/server";

import { releasesService } from "@/server/services/releases/releases.service";

export async function POST() {
  try {
    const result = await releasesService.syncMonthlyEpics();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
