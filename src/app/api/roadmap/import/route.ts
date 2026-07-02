import { NextResponse } from "next/server";

import { roadmapService } from "@/server/services/roadmap/roadmap.service";

export async function POST() {
  try {
    const data = await roadmapService.reimportFromWorkbook();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import workbook" },
      { status: 500 },
    );
  }
}
