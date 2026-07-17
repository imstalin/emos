export const PLANNING_DEFINITIONS: Record<string, string> = {
  Planned: "Issues added before the configured sprint planning boundary.",
  Unplanned: "Issues added after the sprint planning boundary.",
  UnableToDetermine:
    "Milestone history or dates were insufficient to classify planning status.",
  NotApplicable: "Planning status does not apply for this evaluation.",
};

export const DELIVERY_DEFINITIONS: Record<string, string> = {
  Committed: "Planned, eligible issues completed within the sprint.",
  Spillover: "Planned, eligible issues not completed by sprint end.",
  CompletedUnplanned: "Unplanned issues completed within the sprint.",
  OpenUnplanned: "Unplanned issues still open at evaluation time.",
  Excluded:
    "Support, hotfix, or UAT work excluded from commitment reliability.",
  UnableToDetermine: "Delivery outcome could not be determined.",
  NotApplicable: "Delivery status does not apply for this evaluation.",
};

export const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SCHEDULED_PERIODIC: "Scheduled",
  SPRINT_START: "Sprint Start",
  DURING_SPRINT: "During Sprint",
  SPRINT_END: "Sprint End",
  RETRY: "Retry",
  POST_SPRINT_RECONCILIATION: "Post-Sprint Reconciliation",
};

export function badgeClassForStatus(status: string): string {
  switch (status) {
    case "Planned":
    case "Committed":
    case "COMPLETED":
    case "APPLIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "Unplanned":
    case "CompletedUnplanned":
    case "PARTIAL":
    case "SKIPPED":
    case "NOOP":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300";
    case "Spillover":
    case "OpenUnplanned":
    case "QUEUED":
    case "PENDING":
    case "PLANNED":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "UnableToDetermine":
    case "STALE":
    case "REJECTED":
    case "FAILED":
      return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300";
    case "Excluded":
    case "CANCELLED":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
    case "RUNNING":
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
    default:
      return "border-border bg-muted text-foreground";
  }
}

export function shortRunId(runId: string): string {
  return runId.length <= 10 ? runId : `${runId.slice(0, 8)}…`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

export function humanizeStatus(status: string): string {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}
