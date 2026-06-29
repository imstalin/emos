import { NextResponse } from "next/server";

import { followUpTicketService } from "@/server/services/assistant/follow-up-ticket.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ticket = await followUpTicketService.getTicketContext(id);

  if (!ticket) {
    return NextResponse.json(
      { error: "Follow-up not found or has no linked work item" },
      { status: 404 },
    );
  }

  return NextResponse.json(ticket);
}
