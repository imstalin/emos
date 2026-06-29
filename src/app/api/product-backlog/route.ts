import { NextResponse } from "next/server";

import { productBacklogService } from "@/server/services/product-backlog/product-backlog.service";

export async function GET() {
  const data = await productBacklogService.getData();
  return NextResponse.json(data);
}
