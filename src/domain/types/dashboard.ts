import type {
  HealthStatus,
  MemberRole,
  Priority,
  WorkItemState,
  WorkItemType,
} from "@prisma/client";

export type {
  HealthStatus,
  MemberRole,
  Priority,
  WorkItemState,
  WorkItemType,
};

import type { WorkloadBasis } from "@/domain/workload/compute-workload";
import type { DayOnePlanningSummary } from "@/domain/sprint/planning-capacity";

export interface TeamMemberSummary {
  id: string;
  name: string;
  role: MemberRole;
  capacity: number;
  assignedPoints: number;
  activeItems: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  loadBasis: WorkloadBasis;
  wipLimit: number;
  health: HealthStatus;
  lastActivityAt: string | null;
}

export interface WorkItemSummary {
  id: string;
  title: string;
  type: WorkItemType;
  state: WorkItemState;
  priority: Priority;
  health: HealthStatus;
  assigneeName: string | null;
  qaOwnerName: string | null;
  projectName: string;
  dueDate: string | null;
  labels: string[];
  milestoneTitle: string | null;
  backlogCategory: "task" | "defect" | null;
  webUrl: string | null;
}

export interface SprintHealth {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  completedPoints: number;
  totalPoints: number;
  completedItems: number;
  totalItems: number;
  inFlightItems: number;
  velocity: number;
  health: HealthStatus;
  daysRemaining: number;
  loadBasis: WorkloadBasis;
  qaPairedCount: number;
  qaUnassignedCount: number;
  inReviewCount: number;
  inQaCount: number;
  sprintBalanced: boolean;
}

export interface ReleaseHealth {
  id: string;
  version: string;
  name: string | null;
  projectName: string;
  targetDate: string | null;
  openItems: number;
  blockedItems: number;
  health: HealthStatus;
  progressPercent: number;
}

export interface DashboardMetrics {
  generatedAt: string;
  teamStatus: {
    totalMembers: number;
    activeMembers: number;
    developers: number;
    qaMembers: number;
    overallHealth: HealthStatus;
  };
  currentWork: WorkItemSummary[];
  blockers: WorkItemSummary[];
  highPriority: WorkItemSummary[];
  releaseHealth: ReleaseHealth[];
  sprintHealth: SprintHealth | null;
  pendingReviews: WorkItemSummary[];
  qaStatus: {
    inQa: number;
    awaitingQa: number;
    failedQa: number;
    items: WorkItemSummary[];
  };
  productionIssues: WorkItemSummary[];
  productBacklog: {
    tasks: WorkItemSummary[];
    defects: WorkItemSummary[];
  };
  workload: TeamMemberSummary[];
  teamCapacity: {
    totalCapacity: number;
    totalWipLimit: number;
    allocatedPoints: number;
    allocatedItems: number;
    utilizationPercent: number;
    membersOverCapacity: number;
    loadBasis: WorkloadBasis;
  };
  dayOne: DayOnePlanningSummary;
  sprintWorkItems: WorkItemSummary[];
}
