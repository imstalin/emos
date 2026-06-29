import { NextResponse } from "next/server";

import { DEFAULT_PLANNING_SLUG } from "@/domain/types/planning";
import { planningService } from "@/server/services/planning/planning.service";

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
      : DEFAULT_PLANNING_SLUG;

  const document = await planningService.importWorkbook(slug, buffer);
  const summary = planningService.buildSummary(document);

  return NextResponse.json({ document, summary });
}
