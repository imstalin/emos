import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getGitLabConfig } from "@/lib/gitlab-config";
import { sprintResponseService } from "@/server/services/sprint/sprint-response.service";

export const maxDuration = 300;

const querySchema = z.object({
  milestone: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  if (!getGitLabConfig()) {
    return NextResponse.json(
      { error: "GitLab is not configured" },
      { status: 503 },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await sprintResponseService.getSummary(parsed.data.milestone);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load sprint responses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
