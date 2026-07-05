import { NextResponse } from "next/server";
import { z } from "zod";

import { sprintMilestoneService } from "@/server/services/sprint/sprint-milestone.service";

const bodySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startingSprintNumber: z.number().int().positive().optional(),
  closeExpired: z.boolean().optional(),
  confirm: z.literal(true).optional(),
  sync: z.literal(true).optional(),
  syncToDatabase: z.literal(true).optional(),
  teamSlug: z.string().optional(),
});

export async function GET() {
  try {
    const preview = await sprintMilestoneService.preview();
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());

    if (body.sync) {
      const result = await sprintMilestoneService.syncFiscalYearMilestones({
        ...body,
        confirm: true,
      });
      return NextResponse.json(result);
    }

    if (body.syncToDatabase) {
      const result = await sprintMilestoneService.syncToSprintsTable(body);
      return NextResponse.json(result);
    }

    const result = await sprintMilestoneService.createConfirmed(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status = message.includes("confirmation") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
