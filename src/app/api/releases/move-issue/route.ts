import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { releasesService } from "@/server/services/releases/releases.service";

const bodySchema = z.object({
  workItemId: z.string().min(1),
  targetEpicIid: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await releasesService.moveWorkItemToEpic(body);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to move issue";
    logger.error("Release move-issue failed", { error: message });
    const status =
      error instanceof z.ZodError
        ? 400
        : /not found|missing|Only issues|closed epic/i.test(message)
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
