import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueSprintIntelligenceApply } from "@/server/queues/sprint-intelligence.queue";
import { apiError, handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { createSprintIntelligenceExecutionService } from "@/server/services/sprint/sprint-intelligence-execution.service";

const bodySchema = z.object({
  sourceAnalysisRunId: z.string().min(1),
  confirm: z.literal(true),
  requestedBy: z.string().optional(),
});

/**
 * Apply from a persisted analysis run only.
 * Does not accept label plans from the client.
 *
 * Operational note: this app currently has no authentication layer.
 * Production deployments should place EMOS behind access control.
 */
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const service = createSprintIntelligenceExecutionService();
    if (!service) {
      return apiError(
        "GITLAB_NOT_CONFIGURED",
        "GitLab is not configured.",
        503,
      );
    }

    const requested = await service.requestApply({
      sourceAnalysisRunId: body.sourceAnalysisRunId,
      confirm: true,
      requestedBy: body.requestedBy,
    });

    let jobId: string | undefined;
    if (requested.status === "PENDING") {
      jobId = await enqueueSprintIntelligenceApply(requested.runId);
    }

    return NextResponse.json({
      runId: requested.runId,
      status: requested.status,
      jobId: jobId ?? null,
      reused: requested.reused,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
