import type {
  ApplyActionRequest,
  ApplyActionResult,
  CommentContextPanel,
  CommentFeedFilters,
  CommentFeedItem,
  CommentFeedResult,
  CommentTargetType,
  GitLabActionAuditEntry,
  WorkItemContextForAI,
} from "@/domain/types/gitlab-comments-monitor";
import { checkDatabaseConnection, db } from "@/lib/db";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import { commentsMonitorAiService } from "@/server/services/gitlab-comments-monitor/comments-monitor-ai.service";
import { gitlabClient } from "@/server/services/gitlab/gitlab-client.service";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const FEED_CACHE_TTL_MS = 180_000;
const FEED_LOAD_TIMEOUT_MS = 90_000;
const TEAM_MENTION_HANDLES = ["qa", "dev", "team", "engineering"];

function makeCommentId(
  targetType: CommentTargetType,
  projectId: number,
  targetIid: number,
  noteId: number,
): string {
  return `${targetType}:${projectId}:${targetIid}:${noteId}`;
}

function parseCommentId(id: string): {
  targetType: CommentTargetType;
  projectId: number;
  targetIid: number;
  noteId: number;
} | null {
  const parts = id.split(":");
  if (parts.length !== 4) return null;
  const [targetType, projectId, targetIid, noteId] = parts;
  if (targetType !== "issue" && targetType !== "merge_request") return null;
  return {
    targetType,
    projectId: Number(projectId),
    targetIid: Number(targetIid),
    noteId: Number(noteId),
  };
}

export class GitLabCommentsMonitorService {
  private feedCache: {
    items: CommentFeedItem[];
    expiresAt: number;
    currentUser: CommentFeedResult["currentUser"];
  } | null = null;
  private feedLoadPromise: Promise<CommentFeedItem[]> | null = null;

  async getCommentsFeed(
    filters: CommentFeedFilters = {},
  ): Promise<CommentFeedResult> {
    const config = getGitLabConfig();
    if (!config) {
      throw new Error(
        "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID in Settings.",
      );
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));

    let allItems = await this.loadFeedItems();

    const effectiveFilters: CommentFeedFilters = {
      targetType: "issue",
      state: "opened",
      needsActionOnly: filters.needsActionOnly !== false,
      ...filters,
    };

    allItems = this.applyFilters(allItems, effectiveFilters);

    const total = allItems.length;
    const skip = (page - 1) * limit;
    const items = allItems.slice(skip, skip + limit);

    const projectCounts = new Map<number, { name: string; count: number }>();
    const authors = new Set<string>();
    const assignees = new Set<string>();
    const labels = new Set<string>();

    for (const item of allItems) {
      const existing = projectCounts.get(item.projectId);
      if (existing) {
        existing.count += 1;
      } else {
        projectCounts.set(item.projectId, {
          name: item.projectName,
          count: 1,
        });
      }
      authors.add(item.authorUsername);
      if (item.assigneeUsername) assignees.add(item.assigneeUsername);
      for (const label of item.labels) labels.add(label);
    }

    return {
      items,
      total,
      page,
      limit,
      projects: [...projectCounts.entries()]
        .map(([id, value]) => ({ id, name: value.name, count: value.count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      authors: [...authors].sort(),
      assignees: [...assignees].sort(),
      labels: [...labels].sort(),
      currentUser: this.feedCache?.currentUser ?? null,
    };
  }

  async getCommentContext(params: {
    targetType: CommentTargetType;
    projectId: number;
    targetIid: number;
  }): Promise<CommentContextPanel> {
    const project = (await gitlabClient.listMonitoredProjects()).find(
      (p) => p.id === params.projectId,
    );

    if (params.targetType === "issue") {
      const [issue, notes, links, milestones, labelList, members, epics] =
        await Promise.all([
          gitlabClient.fetchIssueDetails(params.projectId, params.targetIid),
          gitlabClient.fetchIssueDiscussions(params.projectId, params.targetIid),
          gitlabClient.listIssueLinks(params.projectId, params.targetIid),
          gitlabClient.listProjectMilestones(params.projectId),
          gitlabClient.listProjectLabels(params.projectId),
          gitlabClient.listGroupMembers(),
          gitlabClient.listGroupEpics(),
        ]);

      const epic = await gitlabClient.findEpicForIssue(issue.id);

      const linkedIssues = links.flatMap((link) => {
        const issues = [link.source_issue, link.target_issue].filter(Boolean);
        return issues
          .filter((item) => item && item.iid !== issue.iid)
          .map((item) => ({
            iid: item!.iid,
            title: item!.title,
            state: item!.state,
            webUrl: item!.web_url,
          }));
      });

      return {
        targetType: "issue",
        projectId: params.projectId,
        projectName: project?.name ?? `Project ${params.projectId}`,
        targetIid: issue.iid,
        targetId: issue.id,
        title: issue.title,
        description: issue.description,
        state: issue.state,
        labels: issue.labels,
        assignee: issue.assignee
          ? {
              id: issue.assignee.id,
              name: issue.assignee.name,
              username: issue.assignee.username,
            }
          : null,
        milestone: issue.milestone,
        epic: epic
          ? { iid: epic.iid, title: epic.title, webUrl: epic.web_url }
          : null,
        dueDate: issue.due_date,
        webUrl: issue.web_url,
        previousComments: notes.map((note) => ({
          id: note.id,
          body: note.body,
          authorName: note.author.name,
          authorUsername: note.author.username,
          createdAt: note.created_at,
          system: note.system,
        })),
        linkedIssues,
        pipeline: null,
        mergeStatus: null,
        reviewers: [],
        draft: null,
        availableLabels: labelList.map((l) => l.name),
        availableMilestones: milestones.map((m) => ({
          id: m.id,
          title: m.title,
        })),
        availableEpics: epics.map((e) => ({ iid: e.iid, title: e.title })),
        availableAssignees: members.map((m) => ({
          id: m.id,
          name: m.name,
          username: m.username,
        })),
      };
    }

    const [mr, notes, pipelines, labelList, members] = await Promise.all([
      gitlabClient.fetchMergeRequestDetails(params.projectId, params.targetIid),
      gitlabClient.fetchMergeRequestDiscussions(
        params.projectId,
        params.targetIid,
      ),
      gitlabClient.fetchMergeRequestPipelines(params.projectId, params.targetIid),
      gitlabClient.listProjectLabels(params.projectId),
      gitlabClient.listGroupMembers(),
    ]);

    const pipeline = mr.head_pipeline ?? pipelines[0] ?? null;

    return {
      targetType: "merge_request",
      projectId: params.projectId,
      projectName: project?.name ?? `Project ${params.projectId}`,
      targetIid: mr.iid,
      targetId: mr.id,
      title: mr.title,
      description: mr.description,
      state: mr.state,
      labels: mr.labels,
      assignee: mr.assignee
        ? {
            id: mr.assignee.id,
            name: mr.assignee.name,
            username: mr.assignee.username,
          }
        : null,
      milestone: null,
      epic: null,
      dueDate: null,
      webUrl: mr.web_url,
      previousComments: notes.map((note) => ({
        id: note.id,
        body: note.body,
        authorName: note.author.name,
        authorUsername: note.author.username,
        createdAt: note.created_at,
        system: note.system,
      })),
      linkedIssues: [],
      pipeline,
      mergeStatus: mr.merge_status,
      reviewers: mr.reviewers.map((r) => ({
        id: r.id,
        name: r.name,
        username: r.username,
      })),
      draft: mr.draft,
      availableLabels: labelList.map((l) => l.name),
      availableMilestones: [],
      availableEpics: [],
      availableAssignees: members.map((m) => ({
        id: m.id,
        name: m.name,
        username: m.username,
      })),
    };
  }

  async buildAIContext(params: {
    targetType: CommentTargetType;
    projectId: number;
    targetIid: number;
  }): Promise<WorkItemContextForAI> {
    if (params.targetType === "issue") {
      const [issue, notes, epic] = await Promise.all([
        gitlabClient.fetchIssueDetails(params.projectId, params.targetIid),
        gitlabClient.fetchIssueDiscussions(params.projectId, params.targetIid),
        gitlabClient
          .fetchIssueDetails(params.projectId, params.targetIid)
          .then((item) => gitlabClient.findEpicForIssue(item.id)),
      ]);
      return { issue, notes, epic };
    }

    const [mergeRequest, notes, pipelines] = await Promise.all([
      gitlabClient.fetchMergeRequestDetails(params.projectId, params.targetIid),
      gitlabClient.fetchMergeRequestDiscussions(
        params.projectId,
        params.targetIid,
      ),
      gitlabClient.fetchMergeRequestPipelines(params.projectId, params.targetIid),
    ]);

    return {
      mergeRequest,
      notes,
      pipeline: mergeRequest.head_pipeline ?? pipelines[0] ?? null,
    };
  }

  async applyAction(request: ApplyActionRequest): Promise<ApplyActionResult> {
    const { actionType, targetType, projectId, targetIid, payload } = request;

    try {
      let message = "Action applied successfully";

      switch (actionType) {
        case "reply": {
          const body = String(payload.body ?? "");
          if (!body.trim()) throw new Error("Reply body is required");
          if (targetType === "issue") {
            await gitlabClient.postIssueComment(projectId, targetIid, body);
          } else {
            await gitlabClient.postMergeRequestComment(
              projectId,
              targetIid,
              body,
            );
          }
          message = "Comment posted to GitLab";
          break;
        }
        case "label_update":
        case "status_update":
        case "release_note": {
          const updatePayload = {
            add_labels: payload.add_labels
              ? String(payload.add_labels)
              : undefined,
            remove_labels: payload.remove_labels
              ? String(payload.remove_labels)
              : undefined,
            labels: payload.labels ? String(payload.labels) : undefined,
            state_event: payload.state_event as "close" | "reopen" | undefined,
          };
          if (targetType === "issue") {
            await gitlabClient.updateIssue(projectId, targetIid, updatePayload);
          } else {
            await gitlabClient.updateMergeRequest(
              projectId,
              targetIid,
              updatePayload,
            );
          }
          message = "Labels/status updated on GitLab";
          break;
        }
        case "assignee_update": {
          if (targetType === "issue") {
            const ids = payload.assignee_ids as number[] | undefined;
            const singleId = payload.assignee_id as number | undefined;
            await gitlabClient.updateIssue(projectId, targetIid, {
              assignee_ids: ids ?? (singleId != null ? [singleId] : []),
            });
          } else {
            await gitlabClient.updateMergeRequest(projectId, targetIid, {
              assignee_id: (payload.assignee_id as number | null) ?? null,
            });
          }
          message = "Assignee updated on GitLab";
          break;
        }
        case "milestone_update": {
          if (targetType !== "issue") {
            throw new Error("Milestones apply to issues only");
          }
          await gitlabClient.updateIssue(projectId, targetIid, {
            milestone_id: (payload.milestone_id as number | null) ?? null,
          });
          message = "Milestone updated on GitLab";
          break;
        }
        case "due_date_update": {
          if (targetType !== "issue") {
            throw new Error("Due dates apply to issues only");
          }
          await gitlabClient.updateIssue(projectId, targetIid, {
            due_date: (payload.due_date as string | null) ?? null,
          });
          message = "Due date updated on GitLab";
          break;
        }
        case "epic_update": {
          if (targetType !== "issue") {
            throw new Error("Epic linking applies to issues only");
          }
          const epicIid = payload.epicIid as number | null;
          if (!epicIid) {
            throw new Error("Epic IID is required");
          }
          const issue = await gitlabClient.fetchIssueDetails(
            projectId,
            targetIid,
          );
          await gitlabClient.assignIssueToEpic(epicIid, issue.id);
          message = "Issue linked to epic on GitLab";
          break;
        }
        case "close_issue": {
          if (targetType !== "issue") {
            throw new Error("Close action applies to issues only");
          }
          await gitlabClient.updateIssue(projectId, targetIid, {
            state_event: "close",
          });
          message = "Issue closed on GitLab";
          break;
        }
        case "mr_review": {
          const body = payload.body ? String(payload.body) : null;
          if (body) {
            await gitlabClient.postMergeRequestComment(
              projectId,
              targetIid,
              body,
            );
            message = "MR review comment posted";
          } else {
            message = "MR review action noted (no comment posted)";
          }
          break;
        }
        default:
          throw new Error(`Unsupported action type: ${actionType}`);
      }

      this.feedCache = null;
      const auditId = await this.recordAudit({
        actionType,
        targetType,
        projectId,
        targetIid,
        payload,
        result: "success",
        error: null,
      });

      return { ok: true, auditId, message };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Action failed";
      logger.error("GitLab action apply failed", { request, error });

      const auditId = await this.recordAudit({
        actionType,
        targetType,
        projectId,
        targetIid,
        payload,
        result: "failed",
        error: errorMessage,
      });

      return {
        ok: false,
        auditId,
        message: "Action failed",
        error: errorMessage,
      };
    }
  }

  async getAuditLog(limit = 50): Promise<GitLabActionAuditEntry[]> {
    const dbAvailable = await checkDatabaseConnection();
    if (!dbAvailable) return [];

    const rows = await db.gitLabActionAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    return rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      targetType: row.targetType,
      projectId: row.projectId,
      targetIid: row.targetIid,
      payload: row.payload as Record<string, unknown>,
      result: row.result as "success" | "failed",
      error: row.error,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  parseCommentId(id: string) {
    return parseCommentId(id);
  }

  getAiService() {
    return commentsMonitorAiService;
  }

  private async loadFeedItems(): Promise<CommentFeedItem[]> {
    if (this.feedCache && this.feedCache.expiresAt > Date.now()) {
      return this.feedCache.items;
    }

    if (this.feedLoadPromise) {
      return this.feedLoadPromise;
    }

    this.feedLoadPromise = this.buildFeedItems().finally(() => {
      this.feedLoadPromise = null;
    });

    return this.feedLoadPromise;
  }

  private async buildFeedItems(): Promise<CommentFeedItem[]> {
    const loadWithTimeout = Promise.race([
      this.fetchFeedFromGitLab(),
      new Promise<CommentFeedItem[]>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "GitLab feed timed out after 90s. Try Refresh or check GitLab connectivity.",
              ),
            ),
          FEED_LOAD_TIMEOUT_MS,
        );
      }),
    ]);

    try {
      return await loadWithTimeout;
    } catch (error) {
      if (this.feedCache?.items.length) {
        logger.warn("GitLab feed refresh failed, serving stale cache", {
          error,
        });
        return this.feedCache.items;
      }
      throw error;
    }
  }

  private async fetchFeedFromGitLab(): Promise<CommentFeedItem[]> {
    const currentUser = await gitlabClient
      .getCurrentUser()
      .catch(() => null);

    const actionableNotes = await gitlabClient.fetchActionableOpenIssueComments(
      currentUser?.username,
    );

    const items: CommentFeedItem[] = actionableNotes.map(
      ({ note, issue, project }) => ({
        id: makeCommentId("issue", project.id, issue.iid, note.id),
        noteId: note.id,
        targetType: "issue" as const,
        projectId: project.id,
        projectName: project.name,
        targetIid: issue.iid,
        targetId: issue.id,
        targetTitle: issue.title,
        targetState: issue.state,
        targetWebUrl: issue.web_url,
        body: note.body,
        authorName: note.author.name,
        authorUsername: note.author.username,
        authorId: note.author.id,
        createdAt: note.created_at,
        labels: issue.labels,
        assigneeName: issue.assignee?.name ?? null,
        assigneeUsername: issue.assignee?.username ?? null,
        milestoneTitle: issue.milestone?.title ?? null,
        epicIid: null,
        epicTitle: null,
        needsAction: true,
        mentionsMe: this.mentionsUser(note.body, currentUser?.username),
        mentionsTeam: this.mentionsTeam(note.body),
      }),
    );

    this.feedCache = {
      items,
      expiresAt: Date.now() + FEED_CACHE_TTL_MS,
      currentUser: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            name: currentUser.name,
          }
        : null,
    };

    return items;
  }

  private applyFilters(
    items: CommentFeedItem[],
    filters: CommentFeedFilters,
  ): CommentFeedItem[] {
    return items.filter((item) => {
      if (filters.projectId && item.projectId !== filters.projectId) {
        return false;
      }
      if (
        filters.author &&
        item.authorUsername.toLowerCase() !== filters.author.toLowerCase()
      ) {
        return false;
      }
      if (
        filters.assignee &&
        item.assigneeUsername?.toLowerCase() !== filters.assignee.toLowerCase()
      ) {
        return false;
      }
      if (filters.label && !item.labels.some((l) => l === filters.label)) {
        return false;
      }
      if (filters.state && item.targetState !== filters.state) {
        return false;
      }
      if (
        filters.targetType &&
        filters.targetType !== "all" &&
        item.targetType !== filters.targetType
      ) {
        return false;
      }
      if (filters.needsActionOnly && !item.needsAction) return false;
      if (filters.dateFrom) {
        if (new Date(item.createdAt) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        if (new Date(item.createdAt) > new Date(filters.dateTo)) return false;
      }
      if (filters.unansweredOnly && !item.needsAction) return false;
      if (filters.mentionsOnly && !item.mentionsMe && !item.mentionsTeam) {
        return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = [
          item.body,
          item.targetTitle,
          item.projectName,
          item.authorName,
          ...item.labels,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  private needsAction(
    note: { id: number; author: { username: string } },
    allNotes: Array<{ id: number; author: { username: string } }>,
    currentUsername?: string,
  ): boolean {
    if (currentUsername && note.author.username === currentUsername) {
      return false;
    }

    const idx = allNotes.findIndex((n) => n.id === note.id);
    if (idx < 0) return false;

    const later = allNotes.slice(idx + 1);
    if (currentUsername) {
      return !later.some((n) => n.author.username === currentUsername);
    }

    return later.length === 0;
  }

  private mentionsUser(body: string, username?: string): boolean {
    if (!username) return false;
    return new RegExp(`@${username}\\b`, "i").test(body);
  }

  private mentionsTeam(body: string): boolean {
    return TEAM_MENTION_HANDLES.some((handle) =>
      new RegExp(`@${handle}\\b`, "i").test(body),
    );
  }

  private async recordAudit(params: {
    actionType: string;
    targetType: string;
    projectId: number;
    targetIid: number;
    payload: Record<string, unknown>;
    result: "success" | "failed";
    error: string | null;
  }): Promise<string> {
    const dbAvailable = await checkDatabaseConnection();
    if (!dbAvailable) {
      logger.info("GitLab action audit (no DB)", params);
      return `local-${Date.now()}`;
    }

    const row = await db.gitLabActionAudit.create({
      data: {
        actionType: params.actionType,
        targetType: params.targetType,
        projectId: params.projectId,
        targetIid: params.targetIid,
        payload: params.payload,
        result: params.result,
        error: params.error,
      },
    });
    return row.id;
  }
}

export const gitlabCommentsMonitorService = new GitLabCommentsMonitorService();
