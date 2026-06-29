import type { MemberRole, WorkItemType } from "@prisma/client";

export interface TimesheetEntry {
  workItemId: string;
  title: string;
  type: WorkItemType;
  projectName: string;
  storyPoints: number | null;
  inferredHours: number;
  activityType: "assigned" | "review";
  lastActivityAt: string;
  webUrl: string | null;
}

export interface MemberTimesheet {
  memberId: string;
  name: string;
  role: MemberRole;
  capacityHours: number;
  inferredHours: number;
  utilizationPercent: number;
  entryCount: number;
  entries: TimesheetEntry[];
}

export interface TimesheetsReport {
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  weekOffset: number;
  totalInferredHours: number;
  totalCapacityHours: number;
  membersWithActivity: number;
  members: MemberTimesheet[];
}
