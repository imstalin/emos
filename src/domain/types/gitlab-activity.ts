import type {
  HealthStatus,
  Priority,
  WorkItemState,
  WorkItemType,
} from "@prisma/client";

export interface GitLabActivityItem {
  id: string;
  title: string;
  type: WorkItemType;
  state: WorkItemState;
  priority: Priority;
  health: HealthStatus;
  assigneeName: string | null;
  projectId: string;
  projectName: string;
  dueDate: string | null;
  labels: string[];
  webUrl: string | null;
  lastActivityAt: string | null;
  gitlabIid: number | null;
}

export interface GitLabActivityProjectOption {
  id: string;
  name: string;
  count: number;
}

export interface GitLabActivityStats {
  total: number;
  issues: number;
  mergeRequests: number;
  open: number;
  inProgress: number;
  inReview: number;
  blocked: number;
}

export interface GitLabActivityResult {
  items: GitLabActivityItem[];
  total: number;
  page: number;
  limit: number;
  stats: GitLabActivityStats;
  projects: GitLabActivityProjectOption[];
}

export interface GitLabActivityFilters {
  type?: WorkItemType;
  state?: WorkItemState;
  priority?: Priority;
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
}
