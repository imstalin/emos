import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const { searchParams } = new URL(_request.url);
  const date = searchParams.get("date") ?? undefined;
  const view = await managerProgressService.getTeamView(teamId, date);
  if (!view) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
