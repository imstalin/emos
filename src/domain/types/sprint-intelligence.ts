/**
 * Sprint Intelligence domain types.
 * Pure domain — no GitLab HTTP, Prisma, BullMQ, or env access.
 */

export type PlanningStatus =
  | "Planned"
  | "Unplanned"
  | "UnableToDetermine"
  | "NotApplicable";

export type DeliveryStatus =
  | "Committed"
  | "Spillover"
  | "CompletedUnplanned"
  | "OpenUnplanned"
  | "Excluded"
  | "UnableToDetermine"
  | "NotApplicable";

export type WorkType =
  | "bug"
  | "enhancement"
  | "tech_debt"
  | "support"
  | "hotfix"
  | "regression"
  | "functional_testing"
  | "uat"
  | "release_validation"
  | "deployment"
  | "other";

export type MilestoneEventAction = "add" | "remove";

export type SprintIntelligenceReasonCode =
  | "ASSIGNED_BEFORE_SPRINT_BOUNDARY"
  | "ASSIGNED_AFTER_SPRINT_BOUNDARY"
  | "ASSIGNED_DURING_ALLOWED_FIRST_DAY"
  | "MILESTONE_HISTORY_UNAVAILABLE"
  | "MILESTONE_REMOVED_AND_REASSIGNED"
  | "MILESTONE_REMOVED_WITHOUT_REASSIGNMENT"
  | "MILESTONE_DATES_MISSING"
  | "CLOSED_WITHIN_SPRINT"
  | "CLOSED_AFTER_SPRINT"
  | "OPEN_AT_SPRINT_END"
  | "REOPENED_ISSUE"
  | "EXCLUDED_SUPPORT"
  | "EXCLUDED_HOTFIX"
  | "EXCLUDED_UAT"
  | "COMPLETED_UNPLANNED"
  | "NOT_ON_TARGET_MILESTONE"
  | "AUDIT_HISTORY_MODE";

/** Automation-owned outcome labels only. */
export interface ManagedOutcomeLabels {
  planned: string;
  committed: string;
  spillover: string;
  completedUnplanned: string;
  unplanned: string;
}

export interface SprintIntelligenceRuleConfig {
  timezone: string;
  allowFirstDayAdditions: boolean;
  supportExcludedFromCommitment: boolean;
  hotfixExcludedFromCommitment: boolean;
  uatExcludedFromCommitment: boolean;
  /** Issue states treated as complete (compared case-insensitively). */
  completionStates: string[];
  managedLabels: ManagedOutcomeLabels;
  /**
   * Map of GitLab label → canonical work type.
   * Supports both automation labels (work::bug) and aliases (Type::Defect).
   */
  workTypeAliases: Record<string, WorkType>;
  /**
   * When false, issues not currently on the target milestone are NotApplicable.
   * When true, the latest assignment cycle is still classified for audit.
   */
  auditHistoryMode: boolean;
}

export interface ResourceMilestoneEvent {
  id: number;
  /** ISO timestamp or Date — when the milestone was added/removed. */
  createdAt: string | Date;
  action: MilestoneEventAction;
  milestoneId: number;
  userId?: number | null;
  userName?: string | null;
}

export interface SprintMilestoneInput {
  id: number;
  title: string;
  /** Calendar date YYYY-MM-DD (GitLab milestone start_date). */
  startDate: string | null;
  /** Calendar date YYYY-MM-DD (GitLab milestone due_date). */
  dueDate: string | null;
}

export interface SprintIntelligenceAssignee {
  id: number;
  name?: string | null;
  username?: string | null;
}

/**
 * Normalized issue input for classification.
 * `closedAt` is the completion timestamp source of truth (live GitLab closed_at).
 * Designed so a future WorkItem.closedAt can be passed without changing engine logic.
 */
export interface SprintIntelligenceIssueInput {
  projectId: number;
  issueId: number;
  issueIid: number;
  title: string;
  /** GitLab state, e.g. "opened" | "closed". */
  state: string;
  labels: string[];
  assignees: SprintIntelligenceAssignee[];
  createdAt: string | Date;
  /** Live GitLab closed_at; null when open / reopened. */
  closedAt: string | Date | null;
  currentMilestoneId: number | null;
  /**
   * Resource milestone events for this issue.
   * `null` means history could not be loaded → UnableToDetermine.
   * Empty array means loaded but no events → UnableToDetermine for assignment.
   */
  milestoneEvents: ResourceMilestoneEvent[] | null;
}

export interface SprintBoundaries {
  sprintStart: Date;
  sprintEnd: Date;
  /** Assignments on or before this instant are planned. */
  planningBoundary: Date;
}

export interface MilestoneAssignmentCycle {
  milestoneId: number;
  assignedAt: Date;
  removedAt: Date | null;
  assignedByUserId: number | null;
  assignedByUserName: string | null;
  /** True when more than one add cycle existed for the target milestone. */
  wasReassigned: boolean;
  orderedEvents: ResourceMilestoneEvent[];
}

export type MilestoneAssignmentResolution =
  | {
      kind: "active";
      cycle: MilestoneAssignmentCycle;
    }
  | {
      kind: "inactive";
      cycle: MilestoneAssignmentCycle | null;
      reasonCode: SprintIntelligenceReasonCode;
    }
  | {
      kind: "unavailable";
      reasonCode: SprintIntelligenceReasonCode;
    };

export interface SprintIssueEvaluation {
  projectId: number;
  issueId: number;
  issueIid: number;
  title: string;
  state: string;
  milestoneId: number;
  milestoneTitle: string;
  assignmentTimestamp: Date | null;
  milestoneRemovalTimestamp: Date | null;
  assignmentUserId: number | null;
  assignmentUserName: string | null;
  sprintStart: Date | null;
  sprintEnd: Date | null;
  planningStatus: PlanningStatus;
  deliveryStatus: DeliveryStatus;
  workTypes: WorkType[];
  excludedFromCommitment: boolean;
  completedWithinSprint: boolean;
  existingLabels: string[];
  labelsToAdd: string[];
  managedLabelsToRemove: string[];
  reasonCodes: SprintIntelligenceReasonCode[];
  evaluatedAt: Date;
  assignees: SprintIntelligenceAssignee[];
  closedAt: Date | null;
}

export interface SprintMetrics {
  plannedCount: number;
  plannedCompletedCount: number;
  committedCount: number;
  spilloverCount: number;
  unplannedCount: number;
  completedUnplannedCount: number;
  regressionCount: number;
  plannedRegressionCount: number;
  unplannedRegressionCount: number;
  supportCount: number;
  hotfixCount: number;
  bugCount: number;
  enhancementCount: number;
  technicalDebtCount: number;
  releaseValidationCount: number;
  deploymentCount: number;
  functionalTestingCount: number;
  uatCount: number;
  /** null when denominator is zero. */
  commitmentReliabilityPercent: number | null;
  spilloverPercent: number | null;
  unplannedWorkPercent: number | null;
  completedUnplannedPercent: number | null;
  regressionSharePercent: number | null;
}

export interface LabelPlan {
  labelsToAdd: string[];
  managedLabelsToRemove: string[];
  desiredManagedLabels: string[];
}
