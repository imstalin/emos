import { NextResponse } from "next/server";
import { z } from "zod";

import { gitlabCommentsMonitorService } from "@/server/services/gitlab-comments-monitor/gitlab-comments-monitor.service";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const entries = await gitlabCommentsMonitorService.getAuditLog(
    parsed.data.limit,
  );
  return NextResponse.json({ entries });
}
