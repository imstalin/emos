import { NextResponse } from "next/server";
import { z } from "zod";

import { gitlabCommentsMonitorService } from "@/server/services/gitlab-comments-monitor/gitlab-comments-monitor.service";

const querySchema = z.object({
  projectId: z.coerce.number().int().optional(),
  author: z.string().optional(),
  assignee: z.string().optional(),
  label: z.string().optional(),
  state: z.string().optional(),
  targetType: z.enum(["issue", "merge_request", "all"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  needsActionOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  unansweredOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  mentionsOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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

  const feedFilters = {
    ...parsed.data,
    targetType: "issue" as const,
    state: "opened",
    needsActionOnly: parsed.data.needsActionOnly !== false,
  };

  try {
    const result = await gitlabCommentsMonitorService.getCommentsFeed(
      feedFilters,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load comments";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
