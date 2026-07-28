export type WeeklyWorkstreamStatus =
  | "Not Started"
  | "Planned"
  | "In Progress"
  | "Ongoing"
  | "Completed"
  | "Blocked"
  | "On Hold";

export type WeeklyWorkstream = {
  id: string;
  name: string;
  owner: string;
  status: WeeklyWorkstreamStatus | string;
  completedThisWeek: string;
  currentProgress: string;
  risks: string;
  targetDate: string;
  nextMilestone: string;
  remarks: string;
};

export type WeeklyStatusConfig = {
  recipientName: string;
  senderName: string;
  timezone: string;
  intro: string;
  overallSummary: string;
  includeSprintIntelligence: boolean;
  additionalItems: string[];
  asks: string[];
  workstreams: WeeklyWorkstream[];
};

export type WeeklySprintIntelligenceSnapshot = {
  milestoneTitle: string;
  completedAt: string | null;
  issuesEvaluated: number;
  plannedCount: number;
  committedCount: number;
  spilloverCount: number;
  spilloverPercent: number | null;
  unplannedCount: number;
  unplannedWorkPercent: number | null;
  completedUnplannedCount: number;
  commitmentReliabilityPercent: number | null;
  bugCount: number;
  readout: string;
};

export type WeeklyStatusDraftInput = {
  config: WeeklyStatusConfig;
  weekEndingDate: Date;
  sprintIntelligence?: WeeklySprintIntelligenceSnapshot | null;
};
