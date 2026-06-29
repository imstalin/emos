import { NextResponse } from "next/server";

import { DEFAULT_PHOENIX_KPI_SLUG } from "@/domain/types/phoenix-kpi";
import { phoenixKpiService } from "@/server/services/kpi/phoenix-kpi.service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const slug =
    typeof formData.get("slug") === "string"
      ? (formData.get("slug") as string)
      : DEFAULT_PHOENIX_KPI_SLUG;

  const data = await phoenixKpiService.importWorkbook(slug, buffer);
  return NextResponse.json(data);
}
