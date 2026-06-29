import { NextResponse } from "next/server";

import { getAssistantStatus } from "@/lib/openai-config";

export async function GET() {
  return NextResponse.json(getAssistantStatus());
}
