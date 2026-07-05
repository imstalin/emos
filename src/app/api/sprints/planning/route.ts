import { NextResponse } from "next/server";

import { sprintPlanningService } from "@/server/services/sprint/sprint-planning.service";

export async function GET() {
  try {
    const board = await sprintPlanningService.getBoard();
    return NextResponse.json(board);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sprint planning board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
