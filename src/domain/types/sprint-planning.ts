import type { MemberRole, Priority, WorkItemState, WorkItemType } from "@prisma/client";

import type { WorkloadBasis } from "@/domain/workload/compute-workload";
import type { DayOnePlanningSummary } from "@/domain/sprint/planning-capacity";

export interface SprintPlanningMember {
  id: string;
  name: string;
  role: MemberRole;
}

export interface SprintPlanningItem {
  id: string;
  title: string;
  type: WorkItemType;
  state: WorkItemState;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  qaOwnerId: string | null;
  qaOwnerName: string | null;
  projectName: string;
  storyPoints: number | null;
  milestoneTitle: string | null;
  webUrl: string | null;
  gitlabIid: number | null;
}

export interface SprintPlanningColumn {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  gitlabMilestoneId: number | null;
  itemCount: number;
  plannedPoints: number;
  loadBasis: WorkloadBasis;
  qaPairedCount: number;
  qaUnassignedCount: number;
  items: SprintPlanningItem[];
}

export interface SprintPlanningBoard {
  generatedAt: string;
  teamCapacity: number;
  teamWipLimit: number;
  dayOne: DayOnePlanningSummary;
  recommendedSprintItems: number;
  qaMembers: SprintPlanningMember[];
  backlog: SprintPlanningItem[];
  sprints: SprintPlanningColumn[];
}

export interface SprintAssignmentResult {
  sprintId: string | null;
  sprintName: string | null;
  assigned: number;
  gitlabUpdated: number;
  gitlabSkipped: number;
  errors: Array<{ workItemId: string; message: string }>;
}

export interface SprintQaOwnerResult {
  updated: number;
  qaOwnerName: string | null;
}
