export type SprintIntelligenceStatus = {
  enabled: boolean;
  dryRunOnly: boolean;
  discoveryEnabled: boolean;
  autoApply: boolean;
  createMissingLabels: boolean;
  timezone: string;
  allowFirstDayAdditions: boolean;
  maxAnalysisAgeMinutes: number;
  gitlabConfigured: boolean;
  worker: {
    redisAvailable: boolean;
    note: string;
  };
  lastSuccessfulAnalysisAt: string | null;
  lastSuccessfulAnalysisRunId: string | null;
  lastSuccessfulAnalysisMilestone: string | null;
};

export type SprintIntelligenceMilestone = {
  milestoneId: number;
  title: string;
  startDate: string;
  dueDate: string;
  isActive: boolean;
  projectIds: number[];
  latestAnalysis: {
    id: string;
    status: string;
    completedAt: string | null;
    triggerType: string;
    createdAt: string;
  } | null;
  activeRun: {
    id: string;
    status: string;
    createdAt: string;
  } | null;
};

export type SprintMetrics = {
  plannedCount?: number;
  committedCount?: number;
  spilloverCount?: number;
  unplannedCount?: number;
  completedUnplannedCount?: number;
  regressionCount?: number;
  supportCount?: number;
  hotfixCount?: number;
  bugCount?: number;
  enhancementCount?: number;
  technicalDebtCount?: number;
  releaseValidationCount?: number;
  deploymentCount?: number;
  uatCount?: number;
  commitmentReliabilityPercent?: number | null;
  unplannedWorkPercent?: number | null;
  spilloverPercent?: number | null;
};

export type SprintRunDetail = {
  id: string;
  mode: "ANALYZE" | "APPLY";
  status: string;
  triggerType: string;
  projectIds: number[];
  milestoneId: number;
  milestoneTitle: string;
  milestoneStartDate: string | null;
  milestoneDueDate: string | null;
  timezone: string;
  dryRun: boolean;
  jobId: string | null;
  analysisHash: string | null;
  sourceAnalysisRunId: string | null;
  summary: Record<string, unknown>;
  metrics: SprintMetrics;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  requestedAt: string;
  evaluationCount: number;
  actionCount: number;
  failedActionCount: number;
  failureCount: number;
  unableToDetermineCount: number;
  stale: boolean;
  applyEligible: boolean;
  actionableLabelChanges: number;
  consumedByApplyRunId: string | null;
  actionEligibility: {
    applyEligible: boolean;
    reasons: string[];
    actionableLabelChanges: number;
    actionableAdds: number;
    actionableRemoves: number;
    stale: boolean;
    consumedByApplyRunId: string | null;
    hashPresent: boolean;
  };
};

export type SprintIssueListItem = {
  id: string;
  projectId: number;
  issueId: number;
  issueIid: number;
  issueTitle: string;
  assigneeUsername: string | null;
  issueWebUrl: string | null;
  planningStatus: string;
  deliveryStatus: string;
  workTypes: string[];
  assignmentTimestamp: string | null;
  completionTimestamp: string | null;
  existingLabels: string[];
  recommendedLabelsToAdd: string[];
  recommendedManagedLabelsToRemove: string[];
  reasonCodes: string[];
  excludedFromCommitment: boolean;
  completedWithinSprint: boolean;
  evaluationErrorCode: string | null;
  evaluationErrorMessage: string | null;
  evaluationStatus: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type IssueFilters = {
  page: number;
  pageSize: number;
  projectId?: number;
  planningStatus?: string;
  deliveryStatus?: string;
  workType?: string;
  state?: "opened" | "closed";
  excludedFromCommitment?: boolean;
  hasRecommendedChanges?: boolean;
  hasEvaluationError?: boolean;
  existingLabel?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export type LabelActionItem = {
  id: string;
  projectId: number;
  issueIid: number;
  label: string;
  action: "ADD" | "REMOVE";
  status: string;
  ownedBefore: boolean;
  ownedAfter: boolean | null;
  plannedAt: string;
  attemptedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ConfigView = {
  values: Record<string, { value: unknown; source: string }>;
  notes: string[];
};

export type ApiErrorBody = {
  error?: { code?: string; message?: string } | string;
};
