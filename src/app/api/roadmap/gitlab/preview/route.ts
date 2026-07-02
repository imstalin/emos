import { NextResponse } from "next/server";

import type { RoadmapItem } from "@/domain/types/roadmap";
import {
  previewGitLabIssue,
} from "@/server/services/roadmap/roadmap-gitlab.service";
import { roadmapItemWithIdSchema } from "@/server/services/roadmap/roadmap.validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = roadmapItemWithIdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid roadmap item", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const preview = await previewGitLabIssue(parsed.data as RoadmapItem);
    return NextResponse.json({ preview, itemId: parsed.data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 },
    );
  }
}
