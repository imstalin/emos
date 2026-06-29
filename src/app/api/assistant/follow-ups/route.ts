import { NextResponse } from "next/server";

import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";

export async function GET() {
  const data = await followUpsService.getDashboard();
  const items = data.items
    .filter((item) => item.priority === "CRITICAL" || item.priority === "HIGH")
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      priority: item.priority,
      assigneeName: item.assigneeName,
      webUrl: item.webUrl,
    }));

  return NextResponse.json({ items });
}
