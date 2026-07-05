import type {
  GitLabConnectionTest,
  GitLabCreateIssuePayload,
  GitLabEpic,
  GitLabGroup,
  GitLabIssue,
  GitLabIssueLink,
  GitLabIssueTimeStats,
  GitLabJob,
  GitLabLabel,
  GitLabMergeRequest,
  GitLabMilestone,
  GitLabCreateMilestonePayload,
  GitLabUpdateMilestonePayload,
  GitLabNote,
  GitLabPipeline,
  GitLabProject,
  GitLabTag,
  GitLabCommit,
  GitLabUpdateIssuePayload,
  GitLabUpdateMergeRequestPayload,
  GitLabUser,
} from "@/domain/types/gitlab";
import type { GitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";

const PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 25_000;

export class GitLabApiProvider implements GitLabProvider {
  constructor(private readonly config: GitLabConfig) {}

  async testConnection(): Promise<GitLabConnectionTest> {
    try {
      const [user, group] = await Promise.all([
        this.fetch<GitLabUser>("/user"),
        this.fetch<{ id: number; name: string; full_path: string }>(
          `/groups/${this.config.groupId}`,
        ),
      ]);

      return {
        ok: true,
        user: { id: user.id, username: user.username, name: user.name },
        group: { id: group.id, name: group.name, full_path: group.full_path },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Connection failed";
      logger.warn("GitLab connection test failed", { error: message });
      return { ok: false, error: message };
    }
  }

  async listGroupProjects(): Promise<GitLabProject[]> {
    return this.listGroupProjectsByGroup(this.config.groupId, {
      includeSubgroups: true,
    });
  }

  async listGroupProjectsByGroup(
    groupId: string | number,
    options?: { includeSubgroups?: boolean },
  ): Promise<GitLabProject[]> {
    return this.fetchPaginated<GitLabProject>(
      `/groups/${encodeURIComponent(String(groupId))}/projects`,
      {
        archived: "false",
        include_subgroups: options?.includeSubgroups === false ? "false" : "true",
        order_by: "name",
        sort: "asc",
      },
    );
  }

  async listProjectTags(projectId: number, maxPages = 1): Promise<GitLabTag[]> {
    return this.fetchPaginated<GitLabTag>(
      `/projects/${projectId}/repository/tags`,
      {
        order_by: "updated",
        sort: "desc",
      },
      maxPages,
    );
  }

  async listProjectCommits(
    projectId: number,
    refName: string,
    maxPages = 1,
  ): Promise<GitLabCommit[]> {
    return this.fetchPaginated<GitLabCommit>(
      `/projects/${projectId}/repository/commits`,
      { ref_name: refName },
      maxPages,
    );
  }

  async getGroup(groupId: string | number): Promise<GitLabGroup> {
    return this.fetch<GitLabGroup>(
      `/groups/${encodeURIComponent(String(groupId))}`,
    );
  }

  async listGroupMilestones(
    groupId: number,
    state: "active" | "closed" | "all" = "active",
  ): Promise<GitLabMilestone[]> {
    return this.fetchPaginated<GitLabMilestone>(
      `/groups/${groupId}/milestones`,
      { state },
    );
  }

  async createGroupMilestone(
    groupId: number,
    payload: GitLabCreateMilestonePayload,
  ): Promise<GitLabMilestone> {
    const body = new URLSearchParams();
    body.set("title", payload.title);
    if (payload.description) body.set("description", payload.description);
    if (payload.start_date) body.set("start_date", payload.start_date);
    if (payload.due_date) body.set("due_date", payload.due_date);

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/groups/${groupId}/milestones`,
      {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": this.config.token,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<GitLabMilestone>;
  }

  async updateGroupMilestone(
    groupId: number,
    milestoneId: number,
    payload: GitLabUpdateMilestonePayload,
  ): Promise<GitLabMilestone> {
    const body = new URLSearchParams();
    if (payload.title) body.set("title", payload.title);
    if (payload.description) body.set("description", payload.description);
    if (payload.start_date) body.set("start_date", payload.start_date);
    if (payload.due_date) body.set("due_date", payload.due_date);
    if (payload.state_event) body.set("state_event", payload.state_event);

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/groups/${groupId}/milestones/${milestoneId}`,
      {
        method: "PUT",
        headers: {
          "PRIVATE-TOKEN": this.config.token,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<GitLabMilestone>;
  }

  async listGroupMembers(): Promise<GitLabUser[]> {
    return this.fetchPaginated<GitLabUser>(
      `/groups/${this.config.groupId}/members/all`,
      {},
    );
  }

  async getProject(projectId: number): Promise<GitLabProject> {
    return this.fetch<GitLabProject>(`/projects/${projectId}`);
  }

  async listProjectIssues(
    projectId: number,
    state: "opened" | "closed" | "all" = "all",
    options?: { updatedAfter?: string; maxPages?: number },
  ): Promise<GitLabIssue[]> {
    const params: Record<string, string> = {
      state,
      order_by: "updated_at",
      sort: "desc",
    };
    if (options?.updatedAfter) {
      params.updated_after = options.updatedAfter;
    }
    return this.fetchPaginated<GitLabIssue>(
      `/projects/${projectId}/issues`,
      params,
      options?.maxPages,
    );
  }

  async getIssue(projectId: number, issueIid: number): Promise<GitLabIssue> {
    return this.fetch<GitLabIssue>(
      `/projects/${projectId}/issues/${issueIid}`,
    );
  }

  async getMergeRequest(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabMergeRequest> {
    return this.fetch<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
    );
  }

  async getCurrentUser(): Promise<GitLabUser> {
    return this.fetch<GitLabUser>("/user");
  }

  async listProjectMergeRequests(
    projectId: number,
  ): Promise<GitLabMergeRequest[]> {
    return this.fetchPaginated<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests`,
      {
        state: "all",
        order_by: "updated_at",
        sort: "desc",
      },
    );
  }

  async createIssueNote(
    projectId: number,
    issueIid: number,
    body: string,
  ): Promise<GitLabNote> {
    return this.postForm<GitLabNote>(
      `/projects/${projectId}/issues/${issueIid}/notes`,
      { body },
    );
  }

  async createMergeRequestNote(
    projectId: number,
    mergeRequestIid: number,
    body: string,
  ): Promise<GitLabNote> {
    return this.postForm<GitLabNote>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`,
      { body },
    );
  }

  async updateIssue(
    projectId: number,
    issueIid: number,
    payload: GitLabUpdateIssuePayload,
  ): Promise<GitLabIssue> {
    return this.putForm<GitLabIssue>(
      `/projects/${projectId}/issues/${issueIid}`,
      this.buildUpdateParams(payload),
    );
  }

  async updateMergeRequest(
    projectId: number,
    mergeRequestIid: number,
    payload: GitLabUpdateMergeRequestPayload,
  ): Promise<GitLabMergeRequest> {
    return this.putForm<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
      this.buildUpdateParams(payload),
    );
  }

  async listProjectLabels(projectId: number): Promise<GitLabLabel[]> {
    return this.fetchPaginated<GitLabLabel>(
      `/projects/${projectId}/labels`,
      { with_counts: "false" },
    );
  }

  async listIssueLinks(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssueLink[]> {
    return this.fetchPaginated<GitLabIssueLink>(
      `/projects/${projectId}/issues/${issueIid}/links`,
      {},
    );
  }

  async listMergeRequestPipelines(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabPipeline[]> {
    return this.fetchPaginated<GitLabPipeline>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/pipelines`,
      { order_by: "id", sort: "desc" },
    );
  }

  async listProjectPipelines(
    projectId: number,
    ref: string,
    maxPages = 1,
  ): Promise<GitLabPipeline[]> {
    return this.fetchPaginated<GitLabPipeline>(
      `/projects/${projectId}/pipelines`,
      { ref, order_by: "id", sort: "desc" },
      maxPages,
    );
  }

  async listPipelineJobs(
    projectId: number,
    pipelineId: number,
  ): Promise<GitLabJob[]> {
    return this.fetchPaginated<GitLabJob>(
      `/projects/${projectId}/pipelines/${pipelineId}/jobs`,
      {},
    );
  }

  async listIssueNotes(projectId: number, issueIid: number): Promise<GitLabNote[]> {
    return this.fetchPaginated<GitLabNote>(
      `/projects/${projectId}/issues/${issueIid}/notes`,
      { sort: "asc", order_by: "created_at" },
    );
  }

  async listMergeRequestNotes(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabNote[]> {
    return this.fetchPaginated<GitLabNote>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`,
      { sort: "asc", order_by: "created_at" },
    );
  }

  async listProjectMilestones(
    projectId: number,
    state: "active" | "closed" | "all" = "active",
  ): Promise<GitLabMilestone[]> {
    return this.fetchPaginated<GitLabMilestone>(
      `/projects/${projectId}/milestones`,
      { state },
    );
  }

  async createProjectMilestone(
    projectId: number,
    payload: GitLabCreateMilestonePayload,
  ): Promise<GitLabMilestone> {
    const body = new URLSearchParams();
    body.set("title", payload.title);
    if (payload.description) body.set("description", payload.description);
    if (payload.start_date) body.set("start_date", payload.start_date);
    if (payload.due_date) body.set("due_date", payload.due_date);

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}/milestones`,
      {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": this.config.token,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<GitLabMilestone>;
  }

  async createProjectIssue(
    projectId: number,
    payload: GitLabCreateIssuePayload,
  ): Promise<GitLabIssue> {
    const body = new URLSearchParams();
    body.set("title", payload.title);
    body.set("description", payload.description);
    if (payload.labels) body.set("labels", payload.labels);
    if (payload.weight != null) body.set("weight", String(payload.weight));
    if (payload.milestone_id != null) {
      body.set("milestone_id", String(payload.milestone_id));
    }
    if (payload.assignee_ids?.length) {
      for (const id of payload.assignee_ids) {
        body.append("assignee_ids[]", String(id));
      }
    }
    if (payload.due_date) body.set("due_date", payload.due_date);

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}/issues`,
      {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": this.config.token,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<GitLabIssue>;
  }

  async getIssueTimeStats(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssueTimeStats> {
    return this.fetch<GitLabIssueTimeStats>(
      `/projects/${projectId}/issues/${issueIid}/time_stats`,
    );
  }

  async listGroupEpics(
    state: "opened" | "closed" | "all" = "opened",
  ): Promise<GitLabEpic[]> {
    return this.fetchPaginated<GitLabEpic>(
      `/groups/${this.config.groupId}/epics`,
      {
        state,
        order_by: "updated_at",
        sort: "desc",
      },
    );
  }

  async listEpicIssues(epicIid: number): Promise<GitLabIssue[]> {
    return this.fetchPaginated<GitLabIssue>(
      `/groups/${this.config.groupId}/epics/${epicIid}/issues`,
      {},
    );
  }

  async assignIssueToEpic(epicIid: number, issueId: number): Promise<void> {
    await this.fetch<unknown>(
      `/groups/${this.config.groupId}/epics/${epicIid}/issues/${issueId}`,
      {},
      "POST",
    );
  }

  private buildUpdateParams(
    payload: GitLabUpdateIssuePayload | GitLabUpdateMergeRequestPayload,
  ): Array<[string, string]> {
    const entries: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) continue;
      if (value === null) {
        entries.push([key, ""]);
        continue;
      }
      if (key === "assignee_ids" && Array.isArray(value)) {
        for (const id of value) {
          entries.push(["assignee_ids[]", String(id)]);
        }
        continue;
      }
      if (key === "reviewer_ids" && Array.isArray(value)) {
        for (const id of value) {
          entries.push(["reviewer_ids[]", String(id)]);
        }
        continue;
      }
      entries.push([key, String(value)]);
    }
    return entries;
  }

  private async postForm<T>(
    path: string,
    fields: Record<string, string>,
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      body.set(key, value);
    }

    const response = await fetch(`${this.config.baseUrl}/api/v4${path}`, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async putForm<T>(
    path: string,
    fields: Array<[string, string]>,
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of fields) {
      body.append(key, value);
    }

    const response = await fetch(`${this.config.baseUrl}/api/v4${path}`, {
      method: "PUT",
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async fetchPaginated<T>(
    path: string,
    params: Record<string, string> = {},
    maxPages?: number,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const response = await this.request(path, {
        ...params,
        per_page: String(PER_PAGE),
        page: String(page),
      });

      const batch = (await response.json()) as T[];
      results.push(...batch);

      const totalPages = Number(response.headers.get("x-total-pages") ?? "1");
      if (
        page >= totalPages ||
        batch.length < PER_PAGE ||
        (maxPages != null && page >= maxPages)
      ) {
        break;
      }
      page += 1;
    }

    return results;
  }

  private async fetch<T>(
    path: string,
    params: Record<string, string> = {},
    method: "GET" | "POST" = "GET",
  ): Promise<T> {
    const response = await this.request(path, params, method);
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  private async request(
    path: string,
    params: Record<string, string> = {},
    method: "GET" | "POST" = "GET",
  ): Promise<Response> {
    const url = new URL(`${this.config.baseUrl}/api/v4${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitLab API ${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
      );
    }

    return response;
  }
}

export function createGitLabProvider(
  config: GitLabConfig,
): GitLabProvider {
  return new GitLabApiProvider(config);
}
