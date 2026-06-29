export type FollowUpCategory =
  | "blocked"
  | "overdue"
  | "stale_review"
  | "stale_activity"
  | "critical"
  | "unassigned"
  | "governance"
  | "workload";

export type FollowUpPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface FollowUpItem {
  id: string;
  category: FollowUpCategory;
  priority: FollowUpPriority;
  title: string;
  reason: string;
  suggestedAction: string;
  workItemId: string | null;
  workItemTitle: string | null;
  assigneeName: string | null;
  projectName: string | null;
  webUrl: string | null;
  dueDate: string | null;
  lastActivityAt: string | null;
}

export interface FollowUpsDashboard {
  generatedAt: string;
  total: number;
  byCategory: Record<FollowUpCategory, number>;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  items: FollowUpItem[];
}

export type FollowUpCategoryFilter = FollowUpCategory | "ALL";
