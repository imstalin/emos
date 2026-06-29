export type Connect3030Status =
  | "PENDING"
  | "SCHEDULED"
  | "COMPLETED"
  | "SKIPPED";

export interface Connect3030KpiHighlight {
  kpi: string;
  score: number | null;
  evidence: string | null;
}

export interface Connect3030FollowUpItem {
  title: string;
  reason: string;
  priority: string;
}

export interface Connect3030AutoBrief {
  generatedAt: string;
  monthKey: string;
  monthLabel: string;
  memberName: string;
  performance: {
    kpiHighlights: Connect3030KpiHighlight[];
    utilizationPercent: number | null;
    itemsClosed: number;
    itemsInProgress: number;
    blockedCount: number;
    reviewsDone: number;
    storyPointsClosed: number;
  };
  talkingPoints: string[];
  suggestedGoals: string[];
  followUpItems: Connect3030FollowUpItem[];
}

export interface Connect3030ActionItem {
  id: string;
  text: string;
  owner: "manager" | "member";
  dueDate: string | null;
  done: boolean;
}

export interface Connect3030Responses {
  performanceDiscussed: string;
  goalsForNextPeriod: string;
  memberCommitments: string;
  managerSupport: string;
  memberFeedback: string;
  actionItems: Connect3030ActionItem[];
}

export interface Connect3030Session {
  id: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  gitlabHandle: string | null;
  monthKey: string;
  monthLabel: string;
  status: Connect3030Status;
  scheduledAt: string | null;
  completedAt: string | null;
  autoBrief: Connect3030AutoBrief;
  responses: Connect3030Responses;
  updatedAt: string;
}

export interface Connect3030Dashboard {
  generatedAt: string;
  monthKey: string;
  monthLabel: string;
  summary: {
    total: number;
    pending: number;
    scheduled: number;
    completed: number;
    skipped: number;
  };
  sessions: Connect3030Session[];
}

export const EMPTY_CONNECT_RESPONSES: Connect3030Responses = {
  performanceDiscussed: "",
  goalsForNextPeriod: "",
  memberCommitments: "",
  managerSupport: "",
  memberFeedback: "",
  actionItems: [],
};

export function monthKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthLabelFromKey(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function responsesFromBrief(brief: Connect3030AutoBrief): Connect3030Responses {
  const kpiLines = brief.performance.kpiHighlights
    .filter((row) => row.score !== null)
    .map((row) => `- ${row.kpi}: ${row.score}% (${row.evidence ?? "no detail"})`)
    .join("\n");

  const talkingPoints = brief.talkingPoints.map((point) => `- ${point}`).join("\n");

  const performanceDiscussed = [
    `Performance review for ${brief.monthLabel}:`,
    "",
    kpiLines || "- KPI data not available for this month.",
    "",
    "Suggested discussion points:",
    talkingPoints || "- Review delivery and blockers.",
    "",
    `Delivery snapshot: ${brief.performance.itemsClosed} closed, ${brief.performance.itemsInProgress} in progress, ${brief.performance.blockedCount} blocked.`,
    brief.performance.utilizationPercent !== null
      ? `Utilization: ${brief.performance.utilizationPercent}%`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const goalsForNextPeriod =
    brief.suggestedGoals.length > 0
      ? brief.suggestedGoals.map((goal) => `- ${goal}`).join("\n")
      : "- Set 1–2 measurable goals for the next 30 days.";

  const actionItems: Connect3030ActionItem[] = brief.followUpItems
    .slice(0, 3)
    .map((item, index) => ({
      id: `auto-${index}`,
      text: `Follow up: ${item.title} — ${item.reason}`,
      owner: "manager" as const,
      dueDate: null,
      done: false,
    }));

  return {
    performanceDiscussed,
    goalsForNextPeriod,
    memberCommitments: "",
    managerSupport: "",
    memberFeedback: "",
    actionItems,
  };
}
