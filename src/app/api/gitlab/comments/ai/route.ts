import { NextResponse } from "next/server";
import { z } from "zod";

import { gitlabCommentsMonitorService } from "@/server/services/gitlab-comments-monitor/gitlab-comments-monitor.service";

const bodySchema = z.object({
  roughText: z.string().min(1).max(2000),
  tone: z.enum([
    "professional",
    "friendly",
    "firm",
    "short",
    "executive",
  ]),
  commentId: z.string().min(1),
  targetType: z.enum(["issue", "merge_request"]),
  projectId: z.coerce.number().int(),
  targetIid: z.coerce.number().int(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const context = await gitlabCommentsMonitorService.buildAIContext({
      targetType: parsed.data.targetType,
      projectId: parsed.data.projectId,
      targetIid: parsed.data.targetIid,
    });

    const result =
      await gitlabCommentsMonitorService.getAiService().generateAIReply(
        parsed.data,
        context,
      );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
