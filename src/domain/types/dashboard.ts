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

export interface TeamMemberSummary {
  id: string;
  name: string;
  role: MemberRole;
  capacity: number;
  assignedPoints: number;
  activeItems: number;
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
  velocity: number;
  health: HealthStatus;
  daysRemaining: number;
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
    allocatedPoints: number;
    utilizationPercent: number;
    membersOverCapacity: number;
  };
}
