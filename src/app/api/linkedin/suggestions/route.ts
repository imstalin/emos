import { NextResponse } from "next/server";
import { z } from "zod";

import { linkedInSuggestionsService } from "@/server/services/linkedin/linkedin-suggestions.service";

const requestSchema = z.object({
  postType: z.enum([
    "weekly_update",
    "milestone",
    "thought_leadership",
    "team_culture",
    "product_vision",
  ]),
  tone: z.enum(["professional", "conversational", "celebratory"]),
  timeRange: z.enum(["week", "month", "quarter"]),
  anonymizeTeam: z.boolean().default(true),
  customFocus: z.string().max(500).optional(),
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

    const result = await linkedInSuggestionsService.generate(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate suggestions",
      },
      { status: 500 },
    );
  }
}
