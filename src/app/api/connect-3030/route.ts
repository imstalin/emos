import { NextResponse } from "next/server";

import { monthKeyFromDate } from "@/domain/types/connect-3030";
import { connect3030Service } from "@/server/services/connect-3030/connect3030.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthKey = searchParams.get("month") ?? monthKeyFromDate(new Date());
  const data = await connect3030Service.getDashboard(monthKey);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { monthKey?: string; action?: string };
  const monthKey = body.monthKey ?? monthKeyFromDate(new Date());

  if (body.action === "refresh") {
    const data = await connect3030Service.refreshBriefs(monthKey);
    return NextResponse.json(data);
  }

  const data = await connect3030Service.getDashboard(monthKey);
  return NextResponse.json(data);
}
