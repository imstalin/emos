import { NextResponse } from "next/server";
import { z } from "zod";

import { gitlabCommentsMonitorService } from "@/server/services/gitlab-comments-monitor/gitlab-comments-monitor.service";

const bodySchema = z.object({
  actionType: z.enum([
    "reply",
    "label_update",
    "status_update",
    "assignee_update",
    "milestone_update",
    "due_date_update",
    "epic_update",
    "close_issue",
    "mr_review",
    "release_note",
  ]),
  targetType: z.enum(["issue", "merge_request"]),
  projectId: z.coerce.number().int(),
  targetIid: z.coerce.number().int(),
  payload: z.record(z.string(), z.unknown()),
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

  const result = await gitlabCommentsMonitorService.applyAction(parsed.data);
  const status = result.ok ? 200 : 422;
  return NextResponse.json(result, { status });
}
