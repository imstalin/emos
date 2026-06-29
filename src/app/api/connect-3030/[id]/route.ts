import { NextResponse } from "next/server";

import type { Connect3030Responses } from "@/domain/types/connect-3030";
import type { Connect3030Status } from "@/domain/types/connect-3030";
import { connect3030Service } from "@/server/services/connect-3030/connect3030.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as {
    status?: Connect3030Status;
    scheduledAt?: string | null;
    responses?: Connect3030Responses;
    autofillFromBrief?: boolean;
  };

  const session = await connect3030Service.updateSession(id, body);
  return NextResponse.json(session);
}
