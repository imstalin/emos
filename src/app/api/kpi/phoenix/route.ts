import { NextResponse } from "next/server";

import type { PhoenixKpiDocument } from "@/domain/types/phoenix-kpi";
import { DEFAULT_PHOENIX_KPI_SLUG } from "@/domain/types/phoenix-kpi";
import { phoenixKpiService } from "@/server/services/kpi/phoenix-kpi.service";

export async function GET() {
  const data = await phoenixKpiService.getData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    slug?: string;
    document: PhoenixKpiDocument;
  };

  if (!body.document) {
    return NextResponse.json({ error: "document is required" }, { status: 400 });
  }

  const slug = body.slug ?? DEFAULT_PHOENIX_KPI_SLUG;
  const data = await phoenixKpiService.saveDocument(slug, body.document);
  return NextResponse.json(data);
}
