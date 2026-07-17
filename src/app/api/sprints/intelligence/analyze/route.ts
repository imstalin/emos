import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueSprintIntelligenceAnalyze } from "@/server/queues/sprint-intelligence.queue";
import { apiError, handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { createSprintIntelligenceExecutionService } from "@/server/services/sprint/sprint-intelligence-execution.service";

const bodySchema = z.object({
  projectIds: z.array(z.number().int().positive()).min(1),
  milestone: z.object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    startDate: z.string().nullable(),
    dueDate: z.string().nullable(),
  }),
  requestedBy: z.string().optional(),
});

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

    const requested = await service.requestAnalysis({
      projectIds: body.projectIds,
      milestone: body.milestone,
      requestedBy: body.requestedBy,
      triggerType: "MANUAL",
    });

    let jobId: string | undefined;
    if (requested.status === "PENDING") {
      jobId = await enqueueSprintIntelligenceAnalyze(requested.runId);
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
