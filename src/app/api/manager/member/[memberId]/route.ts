import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

export async function GET(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await context.params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const view = await managerProgressService.getMemberView(memberId, date);
  if (!view) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
