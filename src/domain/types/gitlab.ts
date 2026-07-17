export interface GitLabUser {
  id: number;
  username: string;
  name: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  description: string | null;
  default_branch: string;
  archived?: boolean;
}

export interface GitLabTag {
  name: string;
  commit: {
    id: string;
  };
}

export interface GitLabCommit {
  id: string;
}

export interface GitLabGroup {
  id: number;
  name: string;
  full_path: string;
  web_url: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: GitLabUser;
  created_at: string;
  system: boolean;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: "opened" | "closed";
  labels: string[];
  milestone: {
    id: number;
    title: string;
    start_date?: string | null;
    due_date?: string | null;
  } | null;
  author?: GitLabUser;
  assignee: GitLabUser | null;
  assignees: GitLabUser[];
  due_date: string | null;
  web_url: string;
  updated_at: string;
  created_at: string;
  /** Present when the issue is closed; null/omitted when open or reopened. */
  closed_at?: string | null;
  weight: number | null;
}

export interface GitLabMilestone {
  id: number;
  title: string;
  state: string;
  start_date?: string | null;
  due_date?: string | null;
  expired?: boolean;
}

export interface GitLabCreateMilestonePayload {
  title: string;
  description?: string;
  start_date?: string;
  due_date?: string;
}

export interface GitLabUpdateMilestonePayload {
  title?: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  state_event?: "close" | "activate";
}

export interface GitLabCreateIssuePayload {
  title: string;
  description: string;
  labels?: string;
  weight?: number;
  milestone_id?: number;
  assignee_ids?: number[];
  due_date?: string;
}

export interface GitLabIssueTimeStats {
  time_estimate: number;
  total_time_spent: number;
  human_time_estimate: string | null;
  human_total_time_spent: string | null;
}

export interface GitLabEpic {
  id: number;
  iid: number;
  work_item_id: number;
  group_id: number;
  title: string;
  description: string | null;
  state: "opened" | "closed";
  web_url: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: "opened" | "closed" | "locked" | "merged";
  labels: string[];
  assignee: GitLabUser | null;
  reviewers: GitLabUser[];
  web_url: string;
  updated_at: string;
  created_at: string;
  draft: boolean;
  merge_status: string;
  has_conflicts?: boolean;
  blocking_discussions_resolved?: boolean;
  head_pipeline?: GitLabPipeline | null;
}

export interface GitLabPipeline {
  id: number;
  status: string;
  web_url: string;
  ref: string;
  sha: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  web_url: string;
}

export interface GitLabLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface GitLabPaginationOptions {
  maxPages?: number;
  perPage?: number;
}

export interface CreateGitLabLabelInput {
  name: string;
  color: string;
  description?: string;
}

export interface EnsureGitLabLabelInput {
  name: string;
  color: string;
  description?: string;
}

export interface EnsureLabelOptions {
  /** When false, missing labels are reported but not created. Default true. */
  createMissingLabels?: boolean;
}

export interface EnsureLabelsResult {
  existing: string[];
  created: string[];
  missing: string[];
  failed: Array<{
    label: string;
    error: string;
  }>;
}

/** Normalized resource milestone event (provider boundary, camelCase). */
export interface GitLabResourceMilestoneEvent {
  id: number;
  action: "add" | "remove";
  createdAt: string;
  milestone: {
    id: number;
    iid?: number;
    title: string;
    startDate?: string | null;
    dueDate?: string | null;
  } | null;
  user?: {
    id: number;
    username?: string;
    name?: string;
  } | null;
}

/** Raw GitLab API snake_case resource milestone event. */
export interface GitLabResourceMilestoneEventRaw {
  id: number;
  action: string;
  created_at: string;
  milestone?: {
    id: number;
    iid?: number;
    title?: string;
    start_date?: string | null;
    due_date?: string | null;
  } | null;
  user?: {
    id: number;
    username?: string;
    name?: string;
  } | null;
}

export interface GitLabIssueLabelMutation {
  labelsToAdd: string[];
  labelsToRemove: string[];
}

export interface GitLabProviderResilienceOptions {
  requestTimeoutMs?: number;
  retryCount?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

export interface GitLabIssueLink {
  id: number;
  link_type: string;
  source_issue?: GitLabIssue;
  target_issue?: GitLabIssue;
}

export interface GitLabUpdateIssuePayload {
  title?: string;
  description?: string;
  labels?: string;
  add_labels?: string;
  remove_labels?: string;
  milestone_id?: number | null;
  assignee_ids?: number[];
  state_event?: "close" | "reopen";
  due_date?: string | null;
  weight?: number | null;
}

export interface GitLabUpdateMergeRequestPayload {
  title?: string;
  description?: string;
  labels?: string;
  add_labels?: string;
  remove_labels?: string;
  assignee_id?: number | null;
  reviewer_ids?: number[];
  state_event?: "close" | "reopen";
  remove_source_branch?: boolean;
}

export interface GitLabConnectionTest {
  ok: boolean;
  user?: { id: number; username: string; name: string };
  group?: { id: number; name: string; full_path: string };
  error?: string;
}

export interface SyncRunSummary {
  id: string;
  source: string;
  entityType: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  itemsCount: number;
  error: string | null;
}

export interface SyncResult {
  syncRunId: string;
  status: "completed" | "failed";
  itemsSynced: number;
  itemsClosed: number;
  projectsProcessed: number;
  error?: string;
}

export interface GitLabSchedulerStatus {
  redisAvailable: boolean;
  intervalMinutes: number;
  scheduled: boolean;
  nextRunAt: string | null;
  queueWaiting: number;
  queueActive: number;
  queuePaused: boolean;
  error?: string;
}

export interface GitLabStatus {
  configured: boolean;
  gitlabUrl: string | null;
  groupId: string | null;
  monitoredProjects: Array<{ gitlabId: number; name: string }>;
  lastSync: SyncRunSummary | null;
  scheduler?: GitLabSchedulerStatus;
  webhook?: {
    url: string | null;
    secretConfigured: boolean;
  };
}
