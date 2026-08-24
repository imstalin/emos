import { NextResponse } from "next/server";
import { z } from "zod";

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
  return NextResponse.json(detail);
}

const overrideSchema = z.object({
  field: z.string().min(1),
  newValue: z.string().min(1),
  reason: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ok = await managerProgressService.applyOverride(id, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: "Override failed" }, { status: 400 });
  }
  const detail = await managerProgressService.getWorkItemDetail(id);
  return NextResponse.json(detail);
}
