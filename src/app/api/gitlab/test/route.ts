import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { gitlabSyncService } from "@/server/services/gitlab/gitlab-sync.service";

export async function POST() {
  if (!gitlabSyncService) {
    return NextResponse.json(
      {
        ok: false,
        error: "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await gitlabSyncService.testConnection();
    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GitLab connection test failed";
    logger.error("GitLab connection test failed", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
