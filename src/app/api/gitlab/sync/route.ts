import { NextResponse } from "next/server";

import { gitlabSyncService } from "@/server/services/gitlab/gitlab-sync.service";

export async function POST() {
  if (!gitlabSyncService) {
    return NextResponse.json(
      {
        error: "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
      },
      { status: 503 },
    );
  }

  const result = await gitlabSyncService.syncAll();

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
