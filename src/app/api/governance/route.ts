import { NextResponse } from "next/server";

import { governanceService } from "@/server/services/governance/governance.service";

export async function GET() {
  const report = await governanceService.getReport();
  return NextResponse.json(report);
}
