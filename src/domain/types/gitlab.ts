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
  milestone: { id: number; title: string } | null;
  assignee: GitLabUser | null;
  assignees: GitLabUser[];
  due_date: string | null;
  web_url: string;
  updated_at: string;
  created_at: string;
  weight: number | null;
}

export interface GitLabMilestone {
  id: number;
  title: string;
  state: string;
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
