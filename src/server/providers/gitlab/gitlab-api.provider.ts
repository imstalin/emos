import type {
  GitLabConnectionTest,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabProject,
  GitLabUser,
} from "@/domain/types/gitlab";
import type { GitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";

const PER_PAGE = 100;

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
    return this.fetchPaginated<GitLabProject>(
      `/groups/${this.config.groupId}/projects`,
      {
        include_subgroups: "true",
        with_issues_enabled: "true",
        order_by: "name",
        sort: "asc",
      },
    );
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

  async listProjectIssues(projectId: number): Promise<GitLabIssue[]> {
    return this.fetchPaginated<GitLabIssue>(`/projects/${projectId}/issues`, {
      state: "opened",
      order_by: "updated_at",
      sort: "desc",
    });
  }

  async listProjectMergeRequests(
    projectId: number,
  ): Promise<GitLabMergeRequest[]> {
    return this.fetchPaginated<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests`,
      {
        state: "opened",
        order_by: "updated_at",
        sort: "desc",
      },
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

  private async fetchPaginated<T>(
    path: string,
    params: Record<string, string> = {},
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
      if (page >= totalPages || batch.length < PER_PAGE) {
        break;
      }
      page += 1;
    }

    return results;
  }

  private async fetch<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const response = await this.request(path, params);
    return response.json() as Promise<T>;
  }

  private async request(
    path: string,
    params: Record<string, string> = {},
  ): Promise<Response> {
    const url = new URL(`${this.config.baseUrl}/api/v4${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        Accept: "application/json",
      },
      cache: "no-store",
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
