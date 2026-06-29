import { NextResponse } from "next/server";

import { DEFAULT_PHOENIX_KPI_SLUG } from "@/domain/types/phoenix-kpi";
import { phoenixKpiService } from "@/server/services/kpi/phoenix-kpi.service";

export async function GET() {
  const buffer = await phoenixKpiService.exportWorkbook();
  const filename = "FY26_KPI_TEAM_DEVELOPMENT_MASTER_SOURCE_PHOENIX.xlsx";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
