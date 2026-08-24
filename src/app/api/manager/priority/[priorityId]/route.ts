import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

export async function GET(
  request: Request,
  context: { params: Promise<{ priorityId: string }> },
) {
  const { priorityId } = await context.params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const view = await managerProgressService.getPriorityView(priorityId, date);
  if (!view) {
    return NextResponse.json({ error: "Priority not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
