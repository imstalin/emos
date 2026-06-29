import { NextResponse } from "next/server";

import { getGitLabConfig, isMonitoredGitLabProject } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import { enqueueGitLabProjectSync } from "@/server/queues/gitlab-sync.queue";
import { parseGitLabWebhookPayload } from "@/server/services/gitlab/gitlab-webhook.parser";
import { createGitLabSyncService } from "@/server/services/gitlab/gitlab-sync.service";

export async function POST(request: Request) {
  const config = getGitLabConfig();
  if (!config) {
    return NextResponse.json(
      { error: "GitLab is not configured" },
      { status: 503 },
    );
  }

  if (config.webhookSecret) {
    const token = request.headers.get("x-gitlab-token");
    if (token !== config.webhookSecret) {
      logger.warn("GitLab webhook rejected — invalid token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseGitLabWebhookPayload(
    payload as Parameters<typeof parseGitLabWebhookPayload>[0],
  );

  if (!parsed.gitlabProjectId) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_project" });
  }

  if (!isMonitoredGitLabProject(parsed.gitlabProjectId)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "unmonitored_project",
      projectId: parsed.gitlabProjectId,
    });
  }

  if (!parsed.supported) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "unsupported_event",
      objectKind: parsed.objectKind,
    });
  }

  try {
    const jobId = await enqueueGitLabProjectSync(parsed.gitlabProjectId);
    return NextResponse.json({
      ok: true,
      queued: true,
      jobId,
      projectId: parsed.gitlabProjectId,
      objectKind: parsed.objectKind,
    });
  } catch (error) {
    logger.warn("Webhook queue unavailable — running inline project sync", {
      error,
    });

    const service = createGitLabSyncService();
    if (!service) {
      return NextResponse.json(
        { error: "Sync service unavailable" },
        { status: 503 },
      );
    }

    const result = await service.syncProject(parsed.gitlabProjectId);
    return NextResponse.json({
      ok: true,
      queued: false,
      inline: true,
      projectId: parsed.gitlabProjectId,
      result,
    });
  }
}
