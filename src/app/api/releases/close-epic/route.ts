import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { releasesService } from "@/server/services/releases/releases.service";

const bodySchema = z
  .object({
    epicId: z.string().min(1).optional(),
    epicIid: z.number().int().positive().optional(),
  })
  .refine((value) => value.epicId != null || value.epicIid != null, {
    message: "epicId or epicIid is required",
  });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await releasesService.closeEpic(body);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to close epic";
    logger.error("Release close-epic failed", { error: message });
    const status =
      error instanceof z.ZodError
        ? 400
        : /not found/i.test(message)
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
