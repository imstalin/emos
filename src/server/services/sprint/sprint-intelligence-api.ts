import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(
  code: string,
  message: string,
  status = 400,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return apiError(
      "VALIDATION_ERROR",
      error.issues.map((issue) => issue.message).join("; "),
      400,
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "RUN_NOT_FOUND" || message.startsWith("RUN_NOT_FOUND")) {
    return apiError("RUN_NOT_FOUND", "The requested sprint analysis run was not found.", 404);
  }
  if (message.startsWith("FEATURE_DISABLED")) {
    return apiError(
      "FEATURE_DISABLED",
      "Sprint Intelligence is disabled. Set SPRINT_INTELLIGENCE_ENABLED=true.",
      403,
    );
  }
  if (message.startsWith("DRY_RUN_ONLY")) {
    return apiError(
      "DRY_RUN_ONLY",
      "Apply is disabled while dry-run-only mode is active.",
      403,
    );
  }
  return apiError("REQUEST_FAILED", message, 400);
}
