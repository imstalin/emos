import type { MemberRole } from "@prisma/client";

import type { WorkloadBasis } from "@/domain/workload/compute-workload";
import type { DayOnePlanningSummary } from "@/domain/sprint/planning-capacity";
import type {
  SprintHealth,
  TeamMemberSummary,
  WorkItemSummary,
} from "@/domain/types/dashboard";

export interface TeamMemberDetail extends TeamMemberSummary {
  gitlabHandle: string | null;
  blockedCount: number;
  inReviewCount: number;
  inQaCount: number;
  qaOwnedCount: number;
  mergeRequestCount: number;
  issueCount: number;
  utilizationPercent: number;
  assignedItems: WorkItemSummary[];
  reviewItems: WorkItemSummary[];
  qaOwnedItems: WorkItemSummary[];
}

export interface TeamDashboardData {
  generatedAt: string;
  sprint: SprintHealth | null;
  teamCapacity: {
    totalCapacity: number;
    totalWipLimit: number;
    allocatedPoints: number;
    allocatedItems: number;
    utilizationPercent: number;
    membersOverCapacity: number;
    loadBasis: WorkloadBasis;
  };
  members: TeamMemberDetail[];
  unassigned: {
    count: number;
    items: WorkItemSummary[];
  };
  filters: {
    developers: number;
    qaMembers: number;
  };
  dayOne: DayOnePlanningSummary;
  sprintWorkItems: WorkItemSummary[];
  qaQueue: WorkItemSummary[];
}

export type TeamRoleFilter = MemberRole | "ALL";
