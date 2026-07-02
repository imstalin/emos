import type { HealthStatus, ReleaseStream } from "@prisma/client";

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

export interface ReleaseEpicDetail {
  id: string;
  epicIid: number;
  title: string;
  stream: ReleaseStream;
  monthKey: string;
  webUrl: string | null;
  state: string;
  plannedHours: number;
  spentHours: number;
  progressPercent: number;
  openItems: number;
  blockedItems: number;
  totalItems: number;
  doneItems: number;
  inReviewItems: number;
  qaItems: number;
  health: HealthStatus;
  checklist: ReleaseChecklistItem[];
  workItems: WorkItemSummary[];
}

export interface MonthlyReleaseGroup {
  monthKey: string;
  label: string;
  epics: ReleaseEpicDetail[];
  totalPlannedHours: number;
  totalSpentHours: number;
  progressPercent: number;
  health: HealthStatus;
}

export interface ReleasesDashboard {
  generatedAt: string;
  activeSprint: SprintHealth | null;
  sprintWorkItems: WorkItemSummary[];
  monthlyReleases: MonthlyReleaseGroup[];
  releases: ReleaseDetail[];
  summary: {
    upcoming: number;
    draft: number;
    atRisk: number;
    activeMonths: number;
    openEpics: number;
    totalPlannedHours: number;
    totalSpentHours: number;
  };
}
