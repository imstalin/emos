import { NextResponse } from "next/server";

import { managerProgressService } from "@/server/services/manager-progress/manager-progress.service";
import { enqueueManagerProgressIngestion } from "@/server/queues/manager-progress-feed.queue";

export async function GET() {
  const [health, scheduler] = await Promise.all([
    managerProgressService.getFeedHealth(),
    Promise.resolve(managerProgressService.getSchedulerInfo()),
  ]);

  return NextResponse.json({ health, scheduler });
}

export async function POST() {
  const jobId = await enqueueManagerProgressIngestion();
  return NextResponse.json({ queued: true, jobId });
}
