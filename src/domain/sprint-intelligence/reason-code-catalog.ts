export type ReasonSeverity = "info" | "warning" | "error";

export type ReasonCodePresentation = {
  code: string;
  title: string;
  explanation: string;
  severity: ReasonSeverity;
  suggestedAction?: string;
};

const CATALOG: Record<string, Omit<ReasonCodePresentation, "code">> = {
  ASSIGNED_BEFORE_SPRINT_BOUNDARY: {
    title: "Planned before sprint",
    explanation:
      "The issue was assigned before the configured sprint planning boundary.",
    severity: "info",
  },
  ASSIGNED_DURING_ALLOWED_FIRST_DAY: {
    title: "Planned on first day",
    explanation:
      "The issue was assigned during the first sprint day, which is treated as planned when first-day additions are allowed.",
    severity: "info",
  },
  ASSIGNED_AFTER_SPRINT_BOUNDARY: {
    title: "Added after planning",
    explanation:
      "The issue was assigned to the milestone after the allowed planning period.",
    severity: "info",
  },
  MILESTONE_HISTORY_UNAVAILABLE: {
    title: "Milestone history unavailable",
    explanation:
      "GitLab did not return enough milestone history to determine when this issue entered the sprint.",
    severity: "warning",
    suggestedAction:
      "Review the issue activity or verify API access, then re-run analysis.",
  },
  MILESTONE_REMOVED_AND_REASSIGNED: {
    title: "Removed and reassigned",
    explanation:
      "The issue was removed from the milestone and later reassigned. The latest assignment cycle was used.",
    severity: "info",
  },
  MILESTONE_REMOVED_WITHOUT_REASSIGNMENT: {
    title: "Removed from milestone",
    explanation:
      "The issue was removed from the target milestone and is no longer an active sprint issue.",
    severity: "info",
  },
  MILESTONE_DATES_MISSING: {
    title: "Sprint dates missing",
    explanation:
      "The milestone is missing a start or due date, so planning and delivery could not be determined.",
    severity: "warning",
    suggestedAction: "Set milestone start and due dates in GitLab, then re-run.",
  },
  CLOSED_WITHIN_SPRINT: {
    title: "Completed within sprint",
    explanation: "The issue was closed on or before the sprint end boundary.",
    severity: "info",
  },
  CLOSED_AFTER_SPRINT: {
    title: "Closed after sprint end",
    explanation: "The issue was closed after the sprint end boundary.",
    severity: "info",
  },
  OPEN_AT_SPRINT_END: {
    title: "Still open",
    explanation: "The issue was not in a completed state at evaluation time.",
    severity: "info",
  },
  REOPENED_ISSUE: {
    title: "Reopened",
    explanation:
      "The issue appears reopened and is no longer treated as completed.",
    severity: "warning",
  },
  EXCLUDED_SUPPORT: {
    title: "Support excluded",
    explanation:
      "Support work is excluded from commitment reliability by configuration.",
    severity: "info",
  },
  EXCLUDED_HOTFIX: {
    title: "Hotfix excluded",
    explanation:
      "Hotfix work is excluded from commitment reliability by configuration.",
    severity: "info",
  },
  EXCLUDED_UAT: {
    title: "UAT excluded",
    explanation:
      "UAT work is excluded from commitment reliability by configuration.",
    severity: "info",
  },
  COMPLETED_UNPLANNED: {
    title: "Completed unplanned work",
    explanation:
      "The issue was added after planning and completed within the sprint.",
    severity: "info",
  },
  NOT_ON_TARGET_MILESTONE: {
    title: "Not on target milestone",
    explanation:
      "The issue is not currently assigned to the selected sprint milestone.",
    severity: "info",
  },
  AUDIT_HISTORY_MODE: {
    title: "Audit history mode",
    explanation:
      "The issue was classified using historical assignment even though it is not currently on the milestone.",
    severity: "info",
  },
  AMBIGUOUS_MILESTONE_MATCH: {
    title: "Milestone match is ambiguous",
    explanation:
      "Multiple GitLab milestones matched the available issue history.",
    severity: "warning",
    suggestedAction:
      "Verify milestone title, dates and project mapping, then re-run analysis.",
  },
  MILESTONE_EVENT_FETCH_FAILED: {
    title: "Event fetch failed",
    explanation:
      "Resource milestone events could not be loaded for this issue.",
    severity: "warning",
    suggestedAction: "Check GitLab API access and re-run analysis.",
  },
  PROJECT_ACCESS_FAILED: {
    title: "Project access failed",
    explanation: "Issues could not be loaded for one of the selected projects.",
    severity: "error",
    suggestedAction: "Verify project visibility and token scopes.",
  },
};

export function presentReasonCode(code: string): ReasonCodePresentation {
  const entry = CATALOG[code];
  if (!entry) {
    return {
      code,
      title: code.replace(/_/g, " ").toLowerCase(),
      explanation: code,
      severity: "info",
    };
  }
  return { code, ...entry };
}

export function presentReasonCodes(codes: string[]): ReasonCodePresentation[] {
  return codes.map(presentReasonCode);
}
