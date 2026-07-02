import { NextResponse } from "next/server";

import { roadmapService } from "@/server/services/roadmap/roadmap.service";
import {
  roadmapItemInputSchema,
  toRoadmapItemInput,
} from "@/server/services/roadmap/roadmap.validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = roadmapItemInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid roadmap item", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = await roadmapService.updateItem(id, toRoadmapItemInput(parsed.data));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update item";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await roadmapService.deleteItem(id);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete item";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
