import { NextResponse } from "next/server";
import { z } from "zod";

import { sprintPlanningService } from "@/server/services/sprint/sprint-planning.service";

const assignSchema = z.object({
  action: z.enum(["assign", "backlog", "plan_active", "set_qa_owner", "auto_assign_qa"]),
  workItemIds: z.array(z.string().min(1)).optional(),
  sprintId: z.string().min(1).optional(),
  qaOwnerId: z.union([z.string().min(1), z.null()]).optional(),
  syncGitLab: z.boolean().optional(),
  maxItems: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const body = assignSchema.parse(await request.json());

    if (body.action === "plan_active") {
      const result = await sprintPlanningService.planActiveSprint({
        maxItems: body.maxItems,
        syncGitLab: body.syncGitLab,
      });
      return NextResponse.json(result);
    }

    if (body.action === "auto_assign_qa") {
      const result = await sprintPlanningService.autoAssignQaOwnersForActiveSprint();
      return NextResponse.json(result);
    }

    if (body.action === "set_qa_owner") {
      const workItemIds = body.workItemIds ?? [];
      if (workItemIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one work item" },
          { status: 400 },
        );
      }

      const result = await sprintPlanningService.setQaOwners({
        workItemIds,
        qaOwnerId: body.qaOwnerId ?? null,
      });
      return NextResponse.json(result);
    }

    const workItemIds = body.workItemIds ?? [];
    if (workItemIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one work item" },
        { status: 400 },
      );
    }

    if (body.action === "assign") {
      if (!body.sprintId) {
        return NextResponse.json({ error: "sprintId is required" }, { status: 400 });
      }

      const result = await sprintPlanningService.assignWorkItems({
        workItemIds,
        sprintId: body.sprintId,
        syncGitLab: body.syncGitLab,
      });
      return NextResponse.json(result);
    }

    const result = await sprintPlanningService.moveToSprintBacklog({
      workItemIds,
      syncGitLab: body.syncGitLab,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sprint assignment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
