import type { MemberRole } from "@prisma/client";

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
  mergeRequestCount: number;
  issueCount: number;
  utilizationPercent: number;
  assignedItems: WorkItemSummary[];
  reviewItems: WorkItemSummary[];
}

export interface TeamDashboardData {
  generatedAt: string;
  sprint: SprintHealth | null;
  teamCapacity: {
    totalCapacity: number;
    allocatedPoints: number;
    utilizationPercent: number;
    membersOverCapacity: number;
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
}

export type TeamRoleFilter = MemberRole | "ALL";
