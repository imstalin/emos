import { NextResponse } from "next/server";

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

  const [status, connection] = await Promise.all([
    gitlabSyncService.getStatus(),
    gitlabSyncService.testConnection(),
  ]);

  return NextResponse.json({ ...status, connection });
}
