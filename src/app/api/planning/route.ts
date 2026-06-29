import { NextResponse } from "next/server";

import { DEFAULT_PLANNING_SLUG } from "@/domain/types/planning";
import type { PlanningCellValue } from "@/domain/types/planning";
import { planningService } from "@/server/services/planning/planning.service";

export async function GET() {
  const document = await planningService.getDocument();
  const summary = planningService.buildSummary(document);
  return NextResponse.json({ document, summary });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    slug?: string;
    sheetName: string;
    rows: PlanningCellValue[][];
  };

  if (!body.sheetName || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: "sheetName and rows are required" },
      { status: 400 },
    );
  }

  const document = await planningService.updateSheet(
    body.slug ?? DEFAULT_PLANNING_SLUG,
    body.sheetName,
    body.rows,
  );

  const summary = planningService.buildSummary(document);
  return NextResponse.json({ document, summary });
}
