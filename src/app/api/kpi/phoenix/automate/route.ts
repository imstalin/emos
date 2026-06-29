import { NextResponse } from "next/server";

import { DEFAULT_PHOENIX_KPI_SLUG } from "@/domain/types/phoenix-kpi";
import { phoenixKpiService } from "@/server/services/kpi/phoenix-kpi.service";

export async function POST() {
  const result = await phoenixKpiService.automate();
  const data = await phoenixKpiService.getData();

  return NextResponse.json({
    ...data,
    automate: result,
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { slug?: string };
  const slug = body.slug ?? DEFAULT_PHOENIX_KPI_SLUG;
  const result = await phoenixKpiService.automate(slug);
  const data = await phoenixKpiService.getData(slug);

  return NextResponse.json({
    ...data,
    automate: result,
  });
}
