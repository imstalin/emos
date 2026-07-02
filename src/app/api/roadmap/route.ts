import { NextResponse } from "next/server";

import { roadmapService } from "@/server/services/roadmap/roadmap.service";
import {
  roadmapItemInputSchema,
  toRoadmapItemInput,
} from "@/server/services/roadmap/roadmap.validation";

export async function GET() {
  const data = await roadmapService.getData();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = roadmapItemInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid roadmap item", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = await roadmapService.createItem(toRoadmapItemInput(parsed.data));
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create item" },
      { status: 500 },
    );
  }
}
