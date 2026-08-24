import type {
  BlockerCategory,
  CorrelationConfidence,
  ManagerAttentionSeverity,
  ProgressAlignment,
  ProgressMovement,
  WorkClassification,
} from "@prisma/client";

export type ProgressIndicator =
  | "meaningful_progress"
  | "active_no_movement"
  | "blocked"
  | "slipping"
  | "completed";

export type FeedHealthStatus = "healthy" | "stale" | "error" | "disabled";

export interface LifecycleStage {
  slug: string;
  name: string;
  order: number;
}

export interface ManagerProgressThresholds {
  highPriorityStagnationDays: number;
  mrReviewWaitingDays: number;
  qaReadyWaitingDays: number;
  releaseProximityDays: number;
  maxActiveWip: number;
  feedStaleMinutes: number;
}

export interface ManagerProgressConfigData {
  lifecycleStages: LifecycleStage[];
  thresholds: ManagerProgressThresholds;
  holidays: string[];
  timezone: string;
}

export const DEFAULT_LIFECYCLE_STAGES: LifecycleStage[] = [
  { slug: "backlog", name: "Backlog", order: 0 },
  { slug: "development", name: "Development", order: 1 },
  { slug: "code_review", name: "Code Review", order: 2 },
  { slug: "qa_ready", name: "QA Ready", order: 3 },
  { slug: "qa", name: "QA", order: 4 },
  { slug: "pprd", name: "PPRD / Pre-production", order: 5 },
  { slug: "release_ready", name: "Release Ready", order: 6 },
  { slug: "production", name: "Production", order: 7 },
  { slug: "completed", name: "Completed", order: 8 },
];

export const DEFAULT_THRESHOLDS: ManagerProgressThresholds = {
  highPriorityStagnationDays: 2,
  mrReviewWaitingDays: 1,
  qaReadyWaitingDays: 1,
  releaseProximityDays: 3,
  maxActiveWip: 3,
  feedStaleMinutes: 30,
};

export const DEFAULT_MANAGER_PROGRESS_CONFIG: ManagerProgressConfigData = {
  lifecycleStages: DEFAULT_LIFECYCLE_STAGES,
  thresholds: DEFAULT_THRESHOLDS,
  holidays: [],
  timezone: "Asia/Kolkata",
};

export interface NormalizedFeedActivity {
  gitlabEventId: string;
  eventType: string;
  title: string;
  description: string | null;
  url: string | null;
  project: string | null;
  repository: string | null;
  branch: string | null;
  commitSha: string | null;
  mrNumber: number | null;
  issueNumber: number | null;
  pipelineId: number | null;
  environment: string | null;
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export interface CorrelationSignal {
  externalReference: string | null;
  confidence: CorrelationConfidence;
  title: string;
}

export interface ProgressEvidenceItem {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  url: string | null;
  memberName: string;
}

export interface ManagerProgressRow {
  workItemId: string;
  priorityName: string | null;
  priorityId: string | null;
  ownerName: string | null;
  ownerId: string | null;
  teamName: string | null;
  teamId: string | null;
  progressToday: ProgressIndicator;
  stage: string;
  stageLabel: string;
  blocker: string | null;
  targetDate: string | null;
  managerAttention: boolean;
  classification: WorkClassification;
  alignment: ProgressAlignment;
  externalReference: string | null;
  title: string;
  nextAction: string | null;
  lastMeaningfulProgressAt: string | null;
  activeWipCount: number | null;
}

export interface ManagerProgressSection {
  key: string;
  title: string;
  items: ManagerProgressRow[];
}

export interface ManagerDailySummary {
  date: string;
  overall: {
    prioritiesMoved: number;
    prioritiesBlocked: number;
    releaseReadyCount: number;
  };
  majorProgress: string[];
  managerAttention: string[];
  noMovement: string[];
}

export interface FeedHealthRow {
  memberId: string;
  memberName: string;
  gitlabUsername: string | null;
  teamName: string;
  feedEnabled: boolean;
  status: FeedHealthStatus;
  lastSuccessfulFetch: string | null;
  lastEventReceived: string | null;
  lastHttpStatus: number | null;
  lastError: string | null;
}

export interface ManagerProgressDashboard {
  generatedAt: string;
  date: string;
  feedHealthWarning: boolean;
  summary: ManagerDailySummary;
  sections: ManagerProgressSection[];
  mainTable: ManagerProgressRow[];
  filters: {
    teams: Array<{ id: string; name: string }>;
    owners: Array<{ id: string; name: string }>;
    priorities: Array<{ id: string; name: string }>;
    stages: LifecycleStage[];
  };
}

export interface MemberProgressView {
  memberId: string;
  memberName: string;
  teamName: string;
  activeWip: number;
  recommendedWip: number;
  contextSwitchingRisk: boolean;
  priorities: ManagerProgressRow[];
  unplannedWork: ManagerProgressRow[];
  evidence: ProgressEvidenceItem[];
}

export interface TeamProgressView {
  teamId: string;
  teamName: string;
  items: ManagerProgressRow[];
}

export interface PriorityDetailView {
  priorityId: string;
  name: string;
  status: "on_track" | "attention" | "blocked" | "no_movement" | "completed";
  stage: string;
  stageLabel: string;
  progressToday: ProgressIndicator;
  todaySummary: string[];
  contributors: string[];
  nextAction: string | null;
  blocker: string | null;
  targetDate: string | null;
  workItems: ManagerProgressRow[];
  evidence: ProgressEvidenceItem[];
}

export interface WeeklyTrendView {
  weekStart: string;
  weekEnd: string;
  prioritiesCompleted: number;
  prioritiesProgressed: number;
  itemsBlocked: number;
  itemsStagnant: number;
  unplannedWorkCount: number;
  mrReviewDelays: number;
  qaWaitingCount: number;
  productionCompletions: number;
}

export interface DsmRow {
  ownerName: string;
  priorityName: string;
  yesterdayMovement: string;
  todayMilestone: string;
  blocker: string | null;
  targetDate: string | null;
}

export interface ManagerProgressFilters {
  date?: string;
  teamId?: string;
  ownerId?: string;
  priorityId?: string;
  project?: string;
  stage?: string;
  status?: string;
  managerAttention?: boolean;
  classification?: WorkClassification;
}

export interface WorkItemOverrideInput {
  field: string;
  newValue: string;
  reason?: string;
}

export interface WorkItemDetailView {
  workItem: ManagerProgressRow;
  evidence: ProgressEvidenceItem[];
  blockers: Array<{
    id: string;
    category: BlockerCategory;
    description: string;
    isConfirmed: boolean;
    isResolved: boolean;
  }>;
  attentionItems: Array<{
    id: string;
    ruleKey: string;
    title: string;
    description: string;
    severity: ManagerAttentionSeverity;
  }>;
  snapshots: Array<{
    date: string;
    previousStage: string | null;
    currentStage: string;
    movement: ProgressMovement;
    summary: string | null;
  }>;
}
