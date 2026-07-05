import type {
  GitLabEpic,
  GitLabIssue,
  GitLabIssueLink,
  GitLabLabel,
  GitLabMergeRequest,
  GitLabMilestone,
  GitLabNote,
  GitLabPipeline,
  GitLabProject,
  GitLabUpdateIssuePayload,
  GitLabUpdateMergeRequestPayload,
  GitLabUser,
} from "@/domain/types/gitlab";
import { getGitLabConfig, isMonitoredGitLabProject } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import {
  createGitLabProvider,
  type GitLabApiProvider,
} from "@/server/providers/gitlab/gitlab-api.provider";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";

const OPEN_ISSUES_PER_PROJECT = 15;
const ISSUE_FETCH_CONCURRENCY = 4;
const ISSUES_UPDATED_WITHIN_DAYS = 21;
const FEED_NOTES_CACHE_TTL_MS = 120_000;

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

type CacheEntry<T> = { data: T; expiresAt: number };

export class GitLabClient {
  private provider: GitLabProvider | null = null;
  private notesCache = new Map<string, CacheEntry<unknown>>();

  private getProvider(): GitLabProvider {
    if (this.provider) return this.provider;
    const config = getGitLabConfig();
    if (!config) {
      throw new Error(
        "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
      );
    }
    this.provider = createGitLabProvider(config);
    return this.provider;
  }

  async getCurrentUser(): Promise<GitLabUser> {
    return this.getProvider().getCurrentUser();
  }

  async listMonitoredProjects(): Promise<GitLabProject[]> {
    const projects = await this.getProvider().listGroupProjects();
    return projects.filter((project) => isMonitoredGitLabProject(project.id));
  }

  async fetchActionableOpenIssueComments(
    currentUsername?: string,
  ): Promise<
    Array<{
      note: GitLabNote;
      issue: GitLabIssue;
      project: GitLabProject;
    }>
  > {
    const projects = await this.listMonitoredProjects();
    const updatedAfter = daysAgoIso(ISSUES_UPDATED_WITHIN_DAYS);
    const results: Array<{
      note: GitLabNote;
      issue: GitLabIssue;
      project: GitLabProject;
    }> = [];

    await mapWithConcurrency(projects, 2, async (project) => {
      try {
        const issues = (
          await this.getProvider().listProjectIssues(project.id, "opened", {
            updatedAfter,
            maxPages: 1,
          })
        ).slice(0, OPEN_ISSUES_PER_PROJECT);

        const projectResults = await mapWithConcurrency(
          issues,
          ISSUE_FETCH_CONCURRENCY,
          async (issue) => {
            try {
              const notes = await this.fetchIssueDiscussions(
                project.id,
                issue.iid,
              );
              const userNotes = notes.filter(
                (entry) => !entry.system && entry.body?.trim(),
              );
              if (userNotes.length === 0) return null;

              const latest = userNotes[userNotes.length - 1];
              if (
                currentUsername &&
                latest.author.username === currentUsername
              ) {
                return null;
              }

              return { note: latest, issue, project };
            } catch (error) {
              logger.warn("Failed to fetch issue notes", {
                projectId: project.id,
                issueIid: issue.iid,
                error,
              });
              return null;
            }
          },
        );

        for (const entry of projectResults) {
          if (entry) results.push(entry);
        }
      } catch (error) {
        logger.warn("Failed to list project issues", {
          projectId: project.id,
          error,
        });
      }
    });

    return results.sort(
      (a, b) =>
        new Date(b.note.created_at).getTime() -
        new Date(a.note.created_at).getTime(),
    );
  }

  async fetchIssueDetails(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssue> {
    return this.getProvider().getIssue(projectId, issueIid);
  }

  async fetchMergeRequestDetails(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabMergeRequest> {
    return this.getProvider().getMergeRequest(projectId, mrIid);
  }

  async fetchIssueDiscussions(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabNote[]> {
    return this.cached(`issue-notes:${projectId}:${issueIid}`, () =>
      this.getProvider().listIssueNotes(projectId, issueIid),
    );
  }

  async fetchMergeRequestDiscussions(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabNote[]> {
    return this.cached(`mr-notes:${projectId}:${mrIid}`, () =>
      this.getProvider().listMergeRequestNotes(projectId, mrIid),
    );
  }

  async postIssueComment(
    projectId: number,
    issueIid: number,
    body: string,
  ): Promise<GitLabNote> {
    this.invalidateNotesCache(projectId, issueIid, "issue");
    return this.getProvider().createIssueNote(projectId, issueIid, body);
  }

  async postMergeRequestComment(
    projectId: number,
    mrIid: number,
    body: string,
  ): Promise<GitLabNote> {
    this.invalidateNotesCache(projectId, mrIid, "merge_request");
    return this.getProvider().createMergeRequestNote(projectId, mrIid, body);
  }

  async updateIssue(
    projectId: number,
    issueIid: number,
    payload: GitLabUpdateIssuePayload,
  ): Promise<GitLabIssue> {
    return this.getProvider().updateIssue(projectId, issueIid, payload);
  }

  async updateMergeRequest(
    projectId: number,
    mrIid: number,
    payload: GitLabUpdateMergeRequestPayload,
  ): Promise<GitLabMergeRequest> {
    return this.getProvider().updateMergeRequest(projectId, mrIid, payload);
  }

  async listProjectLabels(projectId: number): Promise<GitLabLabel[]> {
    return this.getProvider().listProjectLabels(projectId);
  }

  async listProjectMilestones(
    projectId: number,
  ): Promise<GitLabMilestone[]> {
    return this.getProvider().listProjectMilestones(projectId, "active");
  }

  async listGroupMembers(): Promise<GitLabUser[]> {
    return this.getProvider().listGroupMembers();
  }

  async listGroupEpics(): Promise<GitLabEpic[]> {
    return this.getProvider().listGroupEpics("opened");
  }

  async findEpicForIssue(issueId: number): Promise<GitLabEpic | null> {
    const epics = await this.listGroupEpics();
    for (const epic of epics.slice(0, 30)) {
      try {
        const issues = await this.getProvider().listEpicIssues(epic.iid);
        if (issues.some((item) => item.id === issueId)) {
          return epic;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async assignIssueToEpic(epicIid: number, issueId: number): Promise<void> {
    return this.getProvider().assignIssueToEpic(epicIid, issueId);
  }

  async listIssueLinks(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssueLink[]> {
    try {
      return await this.getProvider().listIssueLinks(projectId, issueIid);
    } catch {
      return [];
    }
  }

  async fetchMergeRequestPipelines(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabPipeline[]> {
    try {
      return await this.getProvider().listMergeRequestPipelines(
        projectId,
        mrIid,
      );
    } catch {
      return [];
    }
  }

  private async cached<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const existing = this.notesCache.get(key) as CacheEntry<T> | undefined;
    if (existing && existing.expiresAt > Date.now()) {
      return existing.data;
    }
    const data = await loader();
    this.notesCache.set(key, {
      data,
      expiresAt: Date.now() + FEED_NOTES_CACHE_TTL_MS,
    });
    return data;
  }

  private invalidateNotesCache(
    projectId: number,
    iid: number,
    type: "issue" | "merge_request",
  ): void {
    const prefix =
      type === "issue"
        ? `issue-notes:${projectId}:${iid}`
        : `mr-notes:${projectId}:${iid}`;
    this.notesCache.delete(prefix);
  }
}

export const gitlabClient = new GitLabClient();

export type { GitLabApiProvider };
