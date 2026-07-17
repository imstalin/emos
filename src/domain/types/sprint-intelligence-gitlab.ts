import type {
  ManagedOutcomeLabels,
  SprintIntelligenceRuleConfig,
  SprintIssueEvaluation,
  SprintMetrics,
  SprintMilestoneInput,
} from "@/domain/types/sprint-intelligence";

export type SprintIntelligenceIntegrationErrorCode =
  | "TARGET_MILESTONE_NOT_FOUND"
  | "AMBIGUOUS_MILESTONE_MATCH"
  | "MILESTONE_EVENT_FETCH_FAILED"
  | "PROJECT_ACCESS_FAILED"
  | "ISSUE_LIST_FAILED"
  | "LABEL_LIST_FAILED"
  | "STALE_ANALYSIS"
  | "CONFIRMATION_REQUIRED"
  | "INVALID_ANALYSIS_MODE";

export interface AnalyzeSprintMilestoneInput {
  projectIds: Array<string | number>;
  milestone: SprintMilestoneInput;
  ruleConfig: SprintIntelligenceRuleConfig;
  /** Dry-run never creates labels; this only affects missing-label reporting intent. */
  createMissingLabels: boolean;
  maxConcurrency?: number;
  maxPages?: number;
  /**
   * When true, allow matching events by title alone if ID and date matching fail.
   * Default false — title-only matching is unsafe for duplicate titles.
   */
  allowTitleOnlyMilestoneMatch?: boolean;
}

export interface SprintMilestoneAnalysisFailure {
  projectId: string | number;
  issueIid?: number;
  operation: string;
  code: string;
  message: string;
}

export interface SprintMilestoneLabelPlanEntry {
  projectId: string | number;
  issueIid: number;
  labelsToAdd: string[];
  labelsToRemove: string[];
}

export interface SprintMilestoneAnalysisResult {
  milestone: SprintMilestoneInput;
  startedAt: string;
  completedAt: string;
  mode: "dry-run";
  managedLabels: ManagedOutcomeLabels;
  metrics: SprintMetrics;
  evaluations: SprintIssueEvaluation[];
  labelPlans: SprintMilestoneLabelPlanEntry[];
  missingLabelsByProject: Record<string, string[]>;
  failures: SprintMilestoneAnalysisFailure[];
  summary: {
    projectsProcessed: number;
    issuesRetrieved: number;
    issuesEvaluated: number;
    unableToDetermine: number;
    skipped: number;
    failed: number;
  };
}

export interface ApplySprintMilestoneInput {
  analysis: SprintMilestoneAnalysisResult;
  confirm: true;
  createMissingLabels: boolean;
  /** Keyed by `${projectId}:${issueIid}` → managed labels owned by automation. */
  automationOwnedLabels?: Record<string, string[]>;
  /** Reject analysis older than this many minutes. Default 15. */
  maxAnalysisAgeMinutes?: number;
  maxConcurrency?: number;
}

export interface SprintMilestoneApplyResult {
  mode: "apply";
  startedAt: string;
  completedAt: string;
  createdLabels: Record<string, string[]>;
  applied: Array<{
    projectId: string | number;
    issueIid: number;
    added: string[];
    removed: string[];
  }>;
  skipped: Array<{
    projectId: string | number;
    issueIid: number;
    reason: string;
  }>;
  failed: Array<{
    projectId: string | number;
    issueIid?: number;
    operation: string;
    message: string;
  }>;
}

export interface ManagedLabelDefinition {
  color: string;
  description: string;
}
