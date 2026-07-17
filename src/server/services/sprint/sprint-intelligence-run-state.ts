import type { SprintEvaluationRunStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<
  SprintEvaluationRunStatus,
  SprintEvaluationRunStatus[]
> = {
  PENDING: ["QUEUED", "RUNNING", "REJECTED", "CANCELLED", "FAILED"],
  QUEUED: ["RUNNING", "CANCELLED", "REJECTED", "FAILED"],
  RUNNING: [
    "COMPLETED",
    "PARTIAL",
    "FAILED",
    "STALE",
    "CANCELLED",
    "REJECTED",
  ],
  COMPLETED: [],
  PARTIAL: [],
  FAILED: [],
  CANCELLED: [],
  STALE: [],
  REJECTED: [],
};

export function canTransitionSprintRunStatus(
  from: SprintEvaluationRunStatus,
  to: SprintEvaluationRunStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertSprintRunTransition(
  from: SprintEvaluationRunStatus,
  to: SprintEvaluationRunStatus,
): void {
  if (!canTransitionSprintRunStatus(from, to)) {
    throw new Error(
      `INVALID_RUN_TRANSITION: cannot transition SprintEvaluationRun from ${from} to ${to}`,
    );
  }
}

export function isTerminalSprintRunStatus(
  status: SprintEvaluationRunStatus,
): boolean {
  return (
    status === "COMPLETED" ||
    status === "PARTIAL" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "STALE" ||
    status === "REJECTED"
  );
}

export function isSuccessfulAnalysisStatus(
  status: SprintEvaluationRunStatus,
): boolean {
  return status === "COMPLETED" || status === "PARTIAL";
}
