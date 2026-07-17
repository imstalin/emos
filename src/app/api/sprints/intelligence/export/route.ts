import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/server/services/sprint/sprint-intelligence-api";
import { sprintIntelligenceQueryService } from "@/server/services/sprint/sprint-intelligence-query.service";

const querySchema = z.object({
  runId: z.string().min(1),
  type: z.enum(["issues", "label-actions"]).default("issues"),
  projectId: z.coerce.number().int().positive().optional(),
  planningStatus: z
    .enum(["Planned", "Unplanned", "UnableToDetermine", "NotApplicable"])
    .optional(),
  deliveryStatus: z
    .enum([
      "Committed",
      "Spillover",
      "CompletedUnplanned",
      "OpenUnplanned",
      "Excluded",
      "UnableToDetermine",
      "NotApplicable",
    ])
    .optional(),
  workType: z
    .enum([
      "Regression",
      "Bug",
      "Enhancement",
      "Support",
      "Hotfix",
      "TechnicalDebt",
      "UAT",
      "ReleaseValidation",
      "Deployment",
      "Unknown",
    ])
    .optional(),
  search: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));

    if (query.type === "label-actions") {
      const exported = await sprintIntelligenceQueryService.exportLabelActionsCsv(
        query.runId,
      );
      return new NextResponse(exported.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
        },
      });
    }

    const exported = await sprintIntelligenceQueryService.exportIssuesCsv(
      query.runId,
      {
        projectId: query.projectId,
        planningStatus: query.planningStatus,
        deliveryStatus: query.deliveryStatus,
        workType: query.workType,
        search: query.search,
      },
    );

    return new NextResponse(exported.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "The requested sprint analysis run was not found."
    ) {
      return apiError("RUN_NOT_FOUND", error.message, 404);
    }
    return handleRouteError(error);
  }
}
