import { NextResponse } from "next/server";

import { refreshRoadmapHoursSpent } from "@/server/services/roadmap/roadmap-gitlab.service";
import { roadmapService } from "@/server/services/roadmap/roadmap.service";

export async function POST() {
  try {
    await refreshRoadmapHoursSpent();
    const data = await roadmapService.getData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hours sync failed" },
      { status: 500 },
    );
  }
}
