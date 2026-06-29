import { NextResponse } from "next/server";
import { z } from "zod";

import { timesheetsService } from "@/server/services/timesheets/timesheets.service";

const querySchema = z.object({
  weekOffset: z.coerce.number().int().min(-12).max(0).optional(),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 },
    );
  }

  const report = await timesheetsService.getReport(parsed.data.weekOffset ?? 0);
  return NextResponse.json(report);
}
