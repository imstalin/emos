import type { HealthStatus } from "@prisma/client";

import type {
  ReleaseHealth,
  SprintHealth,
  WorkItemSummary,
} from "@/domain/types/dashboard";

export type ChecklistStatus = "complete" | "at_risk" | "pending";

export interface ReleaseChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
}

export interface ReleaseDetail extends ReleaseHealth {
  description: string | null;
  isDraft: boolean;
  releasedAt: string | null;
  projectId: string;
  totalItems: number;
  doneItems: number;
  inReviewItems: number;
  qaItems: number;
  criticalItems: number;
  checklist: ReleaseChecklistItem[];
  workItems: WorkItemSummary[];
}

export interface ReleasesDashboard {
  generatedAt: string;
  activeSprint: SprintHealth | null;
  sprintWorkItems: WorkItemSummary[];
  releases: ReleaseDetail[];
  summary: {
    upcoming: number;
    draft: number;
    atRisk: number;
  };
}
