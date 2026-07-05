import { NextResponse } from "next/server";
import { z } from "zod";

import type { PhoenixReleasePlanMode } from "@/domain/types/phoenix-release-plan";
import { phoenixReleasePlanService } from "@/server/services/releases/phoenix-release-plan.service";

const modeSchema = z.enum(["main", "dev-qa"]);

function parseMode(value: string | null): PhoenixReleasePlanMode {
  return modeSchema.parse(value ?? "main");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = parseMode(searchParams.get("mode"));
    const preview = await phoenixReleasePlanService.preview(mode);
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const postSchema = z.object({
  mode: modeSchema.default("main"),
  confirm: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const body = postSchema.parse(await request.json());
    const result = await phoenixReleasePlanService.createIssue(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status =
      message.includes("confirmation") || message.includes("configured")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
