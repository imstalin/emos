import { NextResponse } from "next/server";
import { z } from "zod";

import { roadmapAiService } from "@/server/services/roadmap/roadmap-ai.service";

const requestSchema = z.object({
  mode: z.enum(["generate", "rewrite"]),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  project: z.string().trim().min(1),
  category: z.string().trim().min(1),
  priority: z.string().trim().min(1),
  quarter: z.string().trim().min(1),
  assignee: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await roadmapAiService.generateDescription(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed" },
      { status: 500 },
    );
  }
}
