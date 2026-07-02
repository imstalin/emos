import { NextResponse } from "next/server";

import { ADMIN_GITLAB_PROJECT_ID } from "@/domain/types/project-hygiene";
import { buildProjectHygieneReport } from "@/server/services/gitlab/project-hygiene";

export async function GET() {
  const report = await buildProjectHygieneReport(ADMIN_GITLAB_PROJECT_ID);
  return NextResponse.json(report);
}
