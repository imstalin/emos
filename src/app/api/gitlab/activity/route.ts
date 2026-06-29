import { NextResponse } from "next/server";
import { z } from "zod";

import { gitlabActivityService } from "@/server/services/gitlab/gitlab-activity.service";

const querySchema = z.object({
  type: z.enum(["ISSUE", "MERGE_REQUEST", "EPIC"]).optional(),
  state: z
    .enum([
      "OPEN",
      "IN_PROGRESS",
      "IN_REVIEW",
      "QA",
      "BLOCKED",
      "DONE",
      "CLOSED",
    ])
    .optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  projectId: z.string().optional(),
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

  const result = await gitlabActivityService.getActivity(parsed.data);
  return NextResponse.json(result);
}
