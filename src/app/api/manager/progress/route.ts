import type { WorkClassification } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";

const filtersSchema = z.object({
  date: z.string().optional(),
  teamId: z.string().optional(),
  ownerId: z.string().optional(),
  priorityId: z.string().optional(),
  project: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  managerAttention: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  classification: z.string().optional().transform((v) => v as WorkClassification | undefined),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = filtersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dashboard = await managerProgressService.getDashboard(parsed.data);
  return NextResponse.json(dashboard);
}
