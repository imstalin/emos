import type { SyncSource } from "@prisma/client";

import type {
  GitLabIssue,
  GitLabMergeRequest,
  GitLabProject,
  GitLabStatus,
  SyncResult,
  SyncRunSummary,
} from "@/domain/types/gitlab";
import {
  getGitLabConfig,
  getWebhookUrl,
  isMonitoredGitLabProject,
} from "@/lib/gitlab-config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createGitLabProvider,
} from "@/server/providers/gitlab/gitlab-api.provider";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";
import { getGitLabSchedulerStatus } from "@/server/queues/gitlab-sync.queue";
import { linkTeamMembersToGitLab } from "@/server/services/team/team-member-linker.service";
import {
  getMonitoredProjectDbIds,
  getMonitoredProjectLabels,
} from "@/server/services/gitlab/monitored-projects";
import {
  mapHealth,
  mapIssueState,
  mapMergeRequestState,
  mapPriority,
  parseGitLabDate,
  slugifyPath,
} from "@/server/services/gitlab/gitlab.mapper";

const DEFAULT_COLUMNS = [
  { name: "Backlog", slug: "backlog", position: 0 },
  { name: "In Progress", slug: "in-progress", position: 1 },
  { name: "Review", slug: "review", position: 2 },
  { name: "Done", slug: "done", position: 3 },
];

type TeamMemberLookup = {
  id: string;
  gitlabUserId: number | null;
  gitlabHandle: string | null;
};

export class GitLabSyncService {
  constructor(private readonly provider: GitLabProvider) {}

  async testConnection() {
    return this.provider.testConnection();
  }

  async getStatus(): Promise<GitLabStatus> {
    const config = getPublicConfig();
    const [lastSync, scheduler, monitoredProjects] = await Promise.all([
      this.getLastSyncRun(),
      getGitLabSchedulerStatus(),
      getMonitoredProjectLabels(),
    ]);

    return {
      configured: config !== null,
      gitlabUrl: config?.url ?? null,
      groupId: config?.groupId ?? null,
      monitoredProjects,
      lastSync,
      scheduler,
      webhook: {
        url: getWebhookUrl(),
        secretConfigured: Boolean(getGitLabConfig()?.webhookSecret),
      },
    };
  }

  async syncProject(gitlabProjectId: number): Promise<SyncResult> {
    if (!isMonitoredGitLabProject(gitlabProjectId)) {
      logger.info("Skipping sync for unmonitored GitLab project", {
        gitlabProjectId,
      });
      return {
        syncRunId: "",
        status: "completed",
        itemsSynced: 0,
        itemsClosed: 0,
        projectsProcessed: 0,
      };
    }

    const syncRun = await db.syncRun.create({
      data: {
        source: "GITLAB_API",
        entityType: "project_sync",
        status: "running",
        metadata: { gitlabProjectId },
      },
    });

    try {
      const members = await db.teamMember.findMany({
        where: { isActive: true },
        select: { id: true, gitlabUserId: true, gitlabHandle: true },
      });

      const gitlabProject = await this.provider.getProject(gitlabProjectId);
      const project = await this.upsertProject(gitlabProject);
      const syncedGitlabIds = new Set<number>();
      let itemsSynced = 0;

      const [issues, mergeRequests] = await Promise.all([
        this.provider.listProjectIssues(gitlabProjectId),
        this.provider.listProjectMergeRequests(gitlabProjectId),
      ]);

      for (const issue of issues) {
        await this.upsertIssue(issue, project.id, members);
        syncedGitlabIds.add(issue.id);
        itemsSynced += 1;
      }

      for (const mr of mergeRequests) {
        await this.upsertMergeRequest(mr, project.id, members);
        syncedGitlabIds.add(mr.id);
        itemsSynced += 1;
      }

      let itemsClosed = 0;
      if (syncedGitlabIds.size > 0) {
        const closedResult = await db.workItem.updateMany({
          where: {
            syncSource: "GITLAB_API",
            projectId: project.id,
            gitlabId: { notIn: [...syncedGitlabIds] },
            state: { notIn: ["DONE", "CLOSED"] },
          },
          data: { state: "CLOSED" },
        });
        itemsClosed = closedResult.count;
      }

      await db.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "completed",
          finishedAt: new Date(),
          itemsCount: itemsSynced,
          metadata: {
            gitlabProjectId,
            projectPath: gitlabProject.path_with_namespace,
            itemsClosed,
          },
        },
      });

      logger.info("GitLab project sync completed", {
        gitlabProjectId,
        itemsSynced,
        itemsClosed,
      });

      return {
        syncRunId: syncRun.id,
        status: "completed",
        itemsSynced,
        itemsClosed,
        projectsProcessed: 1,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";

      await db.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          error: message,
        },
      });

      logger.error("GitLab project sync failed", {
        gitlabProjectId,
        error: message,
      });

      return {
        syncRunId: syncRun.id,
        status: "failed",
        itemsSynced: 0,
        itemsClosed: 0,
        projectsProcessed: 0,
        error: message,
      };
    }
  }

  async syncAll(): Promise<SyncResult> {
    await db.syncRun.updateMany({
      where: { source: "GITLAB_API", status: "running" },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: "Superseded by a newer sync run",
      },
    });

    const syncRun = await db.syncRun.create({
      data: {
        source: "GITLAB_API",
        entityType: "work_items",
        status: "running",
      },
    });

    try {
      const gitlabUsers = await this.provider.listGroupMembers();
      const membersLinked = await linkTeamMembersToGitLab(gitlabUsers);

      const members = await db.teamMember.findMany({
        where: { isActive: true },
        select: { id: true, gitlabUserId: true, gitlabHandle: true },
      });

      const projects = await this.listProjectsToSync();
      const syncedGitlabIds = new Set<number>();
      let itemsSynced = 0;
      const monitoredDbProjectIds: string[] = [];

      for (const gitlabProject of projects) {
        const project = await this.upsertProject(gitlabProject);
        monitoredDbProjectIds.push(project.id);
        const [issues, mergeRequests] = await Promise.all([
          this.provider.listProjectIssues(gitlabProject.id),
          this.provider.listProjectMergeRequests(gitlabProject.id),
        ]);

        for (const issue of issues) {
          await this.upsertIssue(issue, project.id, members);
          syncedGitlabIds.add(issue.id);
          itemsSynced += 1;
        }

        for (const mr of mergeRequests) {
          await this.upsertMergeRequest(mr, project.id, members);
          syncedGitlabIds.add(mr.id);
          itemsSynced += 1;
        }
      }

      let itemsClosed = 0;

      if (syncedGitlabIds.size > 0 && monitoredDbProjectIds.length > 0) {
        const closedResult = await db.workItem.updateMany({
          where: {
            syncSource: "GITLAB_API",
            gitlabId: { notIn: [...syncedGitlabIds] },
            state: { notIn: ["DONE", "CLOSED"] },
            projectId: { in: monitoredDbProjectIds },
          },
          data: { state: "CLOSED" },
        });
        itemsClosed = closedResult.count;
      }

      const monitoredGitlabIds = getGitLabConfig()?.monitoredProjectIds;
      if (monitoredGitlabIds) {
        const excludedDbIds = await getMonitoredProjectDbIds();
        if (excludedDbIds) {
          const otherProjects = await db.gitLabProject.findMany({
            where: { id: { notIn: excludedDbIds } },
            select: { id: true },
          });
          if (otherProjects.length > 0) {
            const archived = await db.workItem.updateMany({
              where: {
                syncSource: "GITLAB_API",
                projectId: { in: otherProjects.map((project) => project.id) },
                state: { notIn: ["DONE", "CLOSED"] },
              },
              data: { state: "CLOSED" },
            });
            itemsClosed += archived.count;
          }
        }
      }

      let epicSync = { epicsSynced: 0, issuesSynced: 0 };
      try {
        const { releaseEpicSyncService } = await import(
          "@/server/services/releases/release-epic-sync.service"
        );
        epicSync = await releaseEpicSyncService.syncMonthlyReleaseEpics();
      } catch (epicError) {
        logger.warn("Monthly release epic sync failed during GitLab sync", {
          error: epicError,
        });
      }

      await db.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "completed",
          finishedAt: new Date(),
          itemsCount: itemsSynced,
          metadata: {
            projectsProcessed: projects.length,
            itemsClosed,
            membersLinked,
            epicsSynced: epicSync.epicsSynced,
            epicIssuesSynced: epicSync.issuesSynced,
          },
        },
      });

      logger.info("GitLab sync completed", {
        itemsSynced,
        itemsClosed,
        membersLinked,
        projectsProcessed: projects.length,
      });

      return {
        syncRunId: syncRun.id,
        status: "completed",
        itemsSynced,
        itemsClosed,
        projectsProcessed: projects.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";

      await db.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          error: message,
        },
      });

      logger.error("GitLab sync failed", { error: message });

      return {
        syncRunId: syncRun.id,
        status: "failed",
        itemsSynced: 0,
        itemsClosed: 0,
        projectsProcessed: 0,
        error: message,
      };
    }
  }

  private async listProjectsToSync(): Promise<GitLabProject[]> {
    const monitoredIds = getGitLabConfig()?.monitoredProjectIds;
    if (monitoredIds) {
      return Promise.all(
        monitoredIds.map((projectId) => this.provider.getProject(projectId)),
      );
    }

    return this.provider.listGroupProjects();
  }

  private async upsertProject(gitlabProject: GitLabProject) {
    const namespaceSlug = slugifyPath(
      gitlabProject.path_with_namespace.replace(/\//g, "-"),
    );
    const pathSlug = slugifyPath(gitlabProject.path);

    const existing =
      (await db.gitLabProject.findUnique({
        where: { gitlabId: gitlabProject.id },
      })) ??
      (await db.gitLabProject.findFirst({
        where: {
          OR: [
            { gitlabPath: gitlabProject.path_with_namespace },
            { slug: namespaceSlug },
            { slug: pathSlug },
          ],
        },
      }));

    const projectData = {
      name: gitlabProject.name,
      gitlabId: gitlabProject.id,
      gitlabPath: gitlabProject.path_with_namespace,
      description: gitlabProject.description,
      webUrl: gitlabProject.web_url,
      defaultBranch: gitlabProject.default_branch,
    };

    if (existing) {
      return db.gitLabProject.update({
        where: { id: existing.id },
        data: projectData,
      });
    }

    const project = await db.gitLabProject.create({
      data: {
        ...projectData,
        slug: namespaceSlug,
      },
    });

    const workflow = await db.projectWorkflow.create({
      data: {
        projectId: project.id,
        name: `${gitlabProject.name} Workflow`,
        isDefault: true,
      },
    });

    for (const column of DEFAULT_COLUMNS) {
      await db.workflowColumn.create({
        data: {
          workflowId: workflow.id,
          name: column.name,
          slug: column.slug,
          position: column.position,
        },
      });
    }

    return project;
  }

  private async upsertIssue(
    issue: GitLabIssue,
    projectId: string,
    members: TeamMemberLookup[],
  ) {
    const state = mapIssueState(issue);
    const dueDate = parseGitLabDate(issue.due_date);
    const lastActivityAt = parseGitLabDate(issue.updated_at);
    const assignee = resolveAssignee(issue.assignee, members);

    const data = {
      projectId,
      type: "ISSUE" as const,
      state,
      priority: mapPriority(issue.labels, issue.weight),
      health: mapHealth({ state, labels: issue.labels, dueDate, lastActivityAt }),
      gitlabIid: issue.iid,
      gitlabId: issue.id,
      title: issue.title,
      description: issue.description,
      labels: issue.labels,
      milestoneId: issue.milestone?.id ?? null,
      milestoneTitle: issue.milestone?.title ?? null,
      storyPoints: issue.weight,
      dueDate,
      lastActivityAt,
      syncSource: "GITLAB_API" as SyncSource,
      webUrl: issue.web_url,
      assigneeId: assignee?.id ?? null,
    };

    await db.workItem.upsert({
      where: { gitlabId: issue.id },
      create: data,
      update: data,
    });
  }

  private async upsertMergeRequest(
    mr: GitLabMergeRequest,
    projectId: string,
    members: TeamMemberLookup[],
  ) {
    const state = mapMergeRequestState(mr);
    const lastActivityAt = parseGitLabDate(mr.updated_at);
    const assignee = resolveAssignee(mr.assignee, members);
    const reviewer = resolveAssignee(mr.reviewers[0] ?? null, members);

    const data = {
      projectId,
      type: "MERGE_REQUEST" as const,
      state,
      priority: mapPriority(mr.labels, null),
      health: mapHealth({
        state,
        labels: mr.labels,
        dueDate: null,
        lastActivityAt,
      }),
      gitlabIid: mr.iid,
      gitlabId: mr.id,
      title: mr.title,
      description: mr.description,
      labels: mr.labels,
      lastActivityAt,
      reviewStatus: mr.merge_status,
      syncSource: "GITLAB_API" as SyncSource,
      webUrl: mr.web_url,
      assigneeId: assignee?.id ?? null,
      reviewerId: reviewer?.id ?? null,
    };

    await db.workItem.upsert({
      where: { gitlabId: mr.id },
      create: data,
      update: data,
    });
  }

  private async getLastSyncRun(): Promise<SyncRunSummary | null> {
    const run = await db.syncRun.findFirst({
      where: { source: "GITLAB_API" },
      orderBy: { startedAt: "desc" },
    });

    if (!run) return null;

    return {
      id: run.id,
      source: run.source,
      entityType: run.entityType,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      itemsCount: run.itemsCount,
      error: run.error,
    };
  }
}

function resolveAssignee(
  user: { id: number; username: string } | null,
  members: TeamMemberLookup[],
) {
  if (!user) return null;

  return (
    members.find(
      (member) =>
        member.gitlabUserId === user.id ||
        member.gitlabHandle?.toLowerCase() === user.username.toLowerCase(),
    ) ?? null
  );
}

function getPublicConfig() {
  const config = getGitLabConfig();
  if (!config) return null;
  return { url: config.url, groupId: config.groupId };
}

export function createGitLabSyncService(): GitLabSyncService | null {
  const config = getGitLabConfig();
  if (!config) return null;
  return new GitLabSyncService(createGitLabProvider(config));
}

export const gitlabSyncService = createGitLabSyncService();
