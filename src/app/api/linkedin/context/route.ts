import { NextResponse } from "next/server";
import { z } from "zod";

import { buildLinkedInContextSummary } from "@/server/services/linkedin/linkedin-context.service";

const querySchema = z.object({
  timeRange: z.enum(["week", "month", "quarter"]).default("month"),
  anonymizeTeam: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      timeRange: searchParams.get("timeRange") ?? "month",
      anonymizeTeam: searchParams.get("anonymizeTeam") ?? "true",
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const summary = await buildLinkedInContextSummary(
      parsed.data.timeRange,
      parsed.data.anonymizeTeam,
    );

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load context" },
      { status: 500 },
    );
  }
}
