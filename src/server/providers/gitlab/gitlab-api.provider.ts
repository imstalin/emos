import type {
  CreateGitLabLabelInput,
  EnsureGitLabLabelInput,
  EnsureLabelOptions,
  EnsureLabelsResult,
  GitLabConnectionTest,
  GitLabCreateIssuePayload,
  GitLabEpic,
  GitLabGroup,
  GitLabIssue,
  GitLabIssueLabelMutation,
  GitLabIssueLink,
  GitLabIssueTimeStats,
  GitLabJob,
  GitLabLabel,
  GitLabMergeRequest,
  GitLabMilestone,
  GitLabCreateMilestonePayload,
  GitLabUpdateMilestonePayload,
  GitLabNote,
  GitLabPaginationOptions,
  GitLabPipeline,
  GitLabProject,
  GitLabProviderResilienceOptions,
  GitLabResourceMilestoneEvent,
  GitLabResourceMilestoneEventRaw,
  GitLabTag,
  GitLabCommit,
  GitLabUpdateIssuePayload,
  GitLabUpdateMergeRequestPayload,
  GitLabUser,
} from "@/domain/types/gitlab";
import type { GitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";
import { mapResourceMilestoneEvents } from "@/server/providers/gitlab/gitlab-resource-milestone-events";
import {
  DEFAULT_GITLAB_RESILIENCE,
  encodeGitLabProjectId,
  executeGitLabRequest,
  type GitLabResilienceConfig,
  isLabelAlreadyExistsError,
} from "@/server/providers/gitlab/gitlab-request";

const PER_PAGE = 100;

export class GitLabApiProvider implements GitLabProvider {
  private readonly resilience: GitLabResilienceConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: GitLabConfig,
    options?: GitLabProviderResilienceOptions & { fetchImpl?: typeof fetch },
  ) {
    this.resilience = {
      requestTimeoutMs:
        options?.requestTimeoutMs ?? DEFAULT_GITLAB_RESILIENCE.requestTimeoutMs,
      retryCount: options?.retryCount ?? DEFAULT_GITLAB_RESILIENCE.retryCount,
      retryBaseDelayMs:
        options?.retryBaseDelayMs ?? DEFAULT_GITLAB_RESILIENCE.retryBaseDelayMs,
      retryMaxDelayMs:
        options?.retryMaxDelayMs ?? DEFAULT_GITLAB_RESILIENCE.retryMaxDelayMs,
    };
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

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
    projectId: number | string,
    state: "opened" | "closed" | "all" = "all",
    options?: {
      updatedAfter?: string;
      maxPages?: number;
      /** Milestone title filter. Mutually exclusive with milestoneTimebox. */
      milestone?: string;
      /**
       * List-issues `milestone_id` accepts only Any/None/Upcoming/Started.
       * Numeric milestone IDs are rejected by GitLab on this endpoint.
       */
      milestoneTimebox?: "Any" | "None" | "Upcoming" | "Started";
    },
  ): Promise<GitLabIssue[]> {
    const params: Record<string, string> = {
      state,
      order_by: "updated_at",
      sort: "desc",
    };
    if (options?.updatedAfter) {
      params.updated_after = options.updatedAfter;
    }
    // GitLab: milestone (title) and milestone_id (timebox) are mutually exclusive.
    if (options?.milestone) {
      params.milestone = options.milestone;
    } else if (options?.milestoneTimebox) {
      params.milestone_id = options.milestoneTimebox;
    }
    return this.fetchPaginated<GitLabIssue>(
      `/projects/${encodeGitLabProjectId(projectId)}/issues`,
      params,
      options?.maxPages,
    );
  }

  async listGroupIssues(
    groupId: string | number,
    options?: {
      state?: "opened" | "closed" | "all";
      milestone?: string;
      maxPages?: number;
    },
  ): Promise<GitLabIssue[]> {
    const params: Record<string, string> = {
      state: options?.state ?? "all",
      order_by: "updated_at",
      sort: "desc",
    };
    if (options?.milestone) {
      params.milestone = options.milestone;
    }
    return this.fetchPaginated<GitLabIssue>(
      `/groups/${encodeURIComponent(String(groupId))}/issues`,
      params,
      options?.maxPages,
    );
  }

  async getIssue(
    projectId: number | string,
    issueIid: number,
  ): Promise<GitLabIssue> {
    return this.fetch<GitLabIssue>(
      `/projects/${encodeGitLabProjectId(projectId)}/issues/${issueIid}`,
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
    projectId: number | string,
    issueIid: number,
    payload: GitLabUpdateIssuePayload,
  ): Promise<GitLabIssue> {
    return this.putForm<GitLabIssue>(
      `/projects/${encodeGitLabProjectId(projectId)}/issues/${issueIid}`,
      this.buildUpdateParams(payload),
      true,
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

  async listProjectLabels(
    projectId: number | string,
    options?: GitLabPaginationOptions,
  ): Promise<GitLabLabel[]> {
    return this.fetchPaginated<GitLabLabel>(
      `/projects/${encodeGitLabProjectId(projectId)}/labels`,
      { with_counts: "false" },
      options?.maxPages,
      options?.perPage,
    );
  }

  async createProjectLabel(
    projectId: number | string,
    input: CreateGitLabLabelInput,
  ): Promise<GitLabLabel> {
    return this.postForm<GitLabLabel>(
      `/projects/${encodeGitLabProjectId(projectId)}/labels`,
      {
        name: input.name,
        color: input.color,
        ...(input.description ? { description: input.description } : {}),
      },
      false,
    );
  }

  async ensureProjectLabels(
    projectId: number | string,
    labels: EnsureGitLabLabelInput[],
    options?: EnsureLabelOptions,
  ): Promise<EnsureLabelsResult> {
    const createMissing = options?.createMissingLabels !== false;
    const existingLabels = await this.listProjectLabels(projectId);
    const existingNames = new Set(existingLabels.map((label) => label.name));

    const result: EnsureLabelsResult = {
      existing: [],
      created: [],
      missing: [],
      failed: [],
    };

    for (const label of labels) {
      if (existingNames.has(label.name)) {
        result.existing.push(label.name);
        continue;
      }

      result.missing.push(label.name);
      if (!createMissing) {
        continue;
      }

      try {
        await this.createProjectLabel(projectId, label);
        result.created.push(label.name);
        existingNames.add(label.name);
        logger.info("sprint-intelligence.gitlab.label.created", {
          projectId,
          label: label.name,
        });
      } catch (error) {
        if (isLabelAlreadyExistsError(error)) {
          const refreshed = await this.listProjectLabels(projectId);
          if (refreshed.some((item) => item.name === label.name)) {
            result.created.push(label.name);
            existingNames.add(label.name);
            continue;
          }
        }
        result.failed.push({
          label: label.name,
          error: error instanceof Error ? error.message : "Label create failed",
        });
      }
    }

    return result;
  }

  async listIssueResourceMilestoneEvents(
    projectId: number | string,
    issueIid: number,
    options?: GitLabPaginationOptions,
  ): Promise<GitLabResourceMilestoneEvent[]> {
    const raw = await this.fetchPaginated<GitLabResourceMilestoneEventRaw>(
      `/projects/${encodeGitLabProjectId(projectId)}/issues/${issueIid}/resource_milestone_events`,
      {},
      options?.maxPages,
      options?.perPage,
    );
    return mapResourceMilestoneEvents(raw);
  }

  async updateIssueLabels(
    projectId: number | string,
    issueIid: number,
    mutation: GitLabIssueLabelMutation,
  ): Promise<GitLabIssue | null> {
    const labelsToAdd = uniqueLabels(mutation.labelsToAdd);
    const labelsToRemove = uniqueLabels(mutation.labelsToRemove);

    if (labelsToAdd.length === 0 && labelsToRemove.length === 0) {
      return null;
    }

    const updated = await this.updateIssue(projectId, issueIid, {
      add_labels: labelsToAdd.length > 0 ? labelsToAdd.join(",") : undefined,
      remove_labels:
        labelsToRemove.length > 0 ? labelsToRemove.join(",") : undefined,
    });

    logger.info("sprint-intelligence.gitlab.issue.updated", {
      projectId,
      issueIid,
      added: labelsToAdd,
      removed: labelsToRemove,
    });

    return updated;
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
    idempotent = false,
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      body.set(key, value);
    }

    const response = await executeGitLabRequest({
      baseUrl: this.config.baseUrl,
      token: this.config.token,
      path,
      method: "POST",
      body: body.toString(),
      contentType: "application/x-www-form-urlencoded",
      idempotent,
      resilience: this.resilience,
      fetchImpl: this.fetchImpl,
    });

    return response.json() as Promise<T>;
  }

  private async putForm<T>(
    path: string,
    fields: Array<[string, string]>,
    idempotent = false,
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of fields) {
      body.append(key, value);
    }

    const response = await executeGitLabRequest({
      baseUrl: this.config.baseUrl,
      token: this.config.token,
      path,
      method: "PUT",
      body: body.toString(),
      contentType: "application/x-www-form-urlencoded",
      idempotent,
      resilience: this.resilience,
      fetchImpl: this.fetchImpl,
    });

    return response.json() as Promise<T>;
  }

  private async fetchPaginated<T>(
    path: string,
    params: Record<string, string> = {},
    maxPages?: number,
    perPage = PER_PAGE,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const pageSize = perPage > 0 ? perPage : PER_PAGE;
    const seenPages = new Set<number>();

    while (true) {
      if (seenPages.has(page)) {
        break;
      }
      seenPages.add(page);

      const response = await this.request(path, {
        ...params,
        per_page: String(pageSize),
        page: String(page),
      });

      const batch = (await response.json()) as T[];
      results.push(...batch);

      if (maxPages != null && page >= maxPages) {
        break;
      }

      const nextPageHeader = response.headers.get("x-next-page")?.trim();
      if (nextPageHeader) {
        const nextPage = Number(nextPageHeader);
        if (!Number.isFinite(nextPage) || nextPage <= page) {
          break;
        }
        page = nextPage;
        continue;
      }

      const totalPages = Number(response.headers.get("x-total-pages") ?? "0");
      if (Number.isFinite(totalPages) && totalPages > 0) {
        if (page >= totalPages || batch.length < pageSize) {
          break;
        }
        page += 1;
        continue;
      }

      if (batch.length < pageSize) {
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
    return executeGitLabRequest({
      baseUrl: this.config.baseUrl,
      token: this.config.token,
      path,
      method,
      params,
      idempotent: method === "GET",
      resilience: this.resilience,
      fetchImpl: this.fetchImpl,
    });
  }
}

function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

export function createGitLabProvider(
  config: GitLabConfig,
  options?: GitLabProviderResilienceOptions & { fetchImpl?: typeof fetch },
): GitLabProvider {
  return new GitLabApiProvider(config, options);
}
