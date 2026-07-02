import { NextResponse } from "next/server";
import { z } from "zod";

import { createGitLabIssueById } from "@/server/services/roadmap/roadmap-gitlab.service";

const requestSchema = z.object({
  itemId: z.string().min(1),
  confirmed: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Confirmation required before creating GitLab issue" },
        { status: 400 },
      );
    }

    const result = await createGitLabIssueById(parsed.data.itemId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
