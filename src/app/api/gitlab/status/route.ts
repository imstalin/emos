import { NextResponse } from "next/server";

import { formatApiError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { gitlabSyncService } from "@/server/services/gitlab/gitlab-sync.service";

export async function GET() {
  if (!gitlabSyncService) {
    return NextResponse.json(
      {
        configured: false,
        error: "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
      },
      { status: 503 },
    );
  }

  try {
    const [status, connection] = await Promise.all([
      gitlabSyncService.getStatus(),
      gitlabSyncService.testConnection(),
    ]);

    return NextResponse.json({ ...status, connection });
  } catch (error) {
    const message = formatApiError(error, "Failed to load GitLab status");
    logger.error("GitLab status request failed", { error: message });
    return NextResponse.json({ configured: true, error: message }, { status: 500 });
  }
}
