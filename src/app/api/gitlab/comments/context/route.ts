import { NextResponse } from "next/server";
import { z } from "zod";

import { gitlabCommentsMonitorService } from "@/server/services/gitlab-comments-monitor/gitlab-comments-monitor.service";

const querySchema = z.object({
  targetType: z.enum(["issue", "merge_request"]),
  projectId: z.coerce.number().int(),
  targetIid: z.coerce.number().int(),
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

  try {
    const context = await gitlabCommentsMonitorService.getCommentContext(
      parsed.data,
    );
    return NextResponse.json(context);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load context";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
