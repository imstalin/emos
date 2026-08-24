import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const detail = await managerProgressService.getWorkItemDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }
  return NextResponse.json({ evidence: detail.evidence });
}
