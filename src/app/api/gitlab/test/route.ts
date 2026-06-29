import { NextResponse } from "next/server";

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

  const result = await gitlabSyncService.testConnection();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
  });
}
