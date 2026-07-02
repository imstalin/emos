import type { ReleaseStream } from "@prisma/client";

import type { GitLabIssue } from "@/domain/types/gitlab";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import {
  mapHealth,
  mapIssueState,
  mapPriority,
  parseGitLabDate,
} from "@/server/services/gitlab/gitlab.mapper";
import { parseMonthlyReleaseEpicTitle } from "@/server/services/releases/release-epic.parser";

type TeamMemberLookup = {
  id: string;
  gitlabUserId: number | null;
  gitlabHandle: string | null;
};

function getProvider() {
  const config = getGitLabConfig();
  if (!config) {
    throw new Error("GitLab is not configured");
  }
  return { provider: createGitLabProvider(config), config };
}

function resolveAssignee(
  assignee: GitLabIssue["assignee"],
  members: TeamMemberLookup[],
) {
  if (!assignee) return null;
  return (
    members.find((member) => member.gitlabUserId === assignee.id) ??
    members.find(
      (member) =>
        member.gitlabHandle?.toLowerCase() === assignee.username.toLowerCase(),
    ) ??
    null
  );
}

async function upsertEpicIssue(
  issue: GitLabIssue,
  epicIid: number,
  members: TeamMemberLookup[],
) {
  const project = await db.gitLabProject.findUnique({
    where: { gitlabId: issue.project_id },
  });
  if (!project) return null;

  const state = mapIssueState(issue);
  const dueDate = parseGitLabDate(issue.due_date);
  const lastActivityAt = parseGitLabDate(issue.updated_at);
  const assignee = resolveAssignee(issue.assignee, members);

  let timeSpentSeconds: number | null = null;
  let timeEstimateSeconds: number | null = null;

  try {
    const { provider } = getProvider();
    const stats = await provider.getIssueTimeStats(issue.project_id, issue.iid);
    timeSpentSeconds = stats.total_time_spent;
    timeEstimateSeconds = stats.time_estimate;
  } catch {
    // Keep issue sync even if time stats fail.
  }

  const data = {
    projectId: project.id,
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
    parentEpicIid: epicIid,
    timeSpentSeconds,
    timeEstimateSeconds,
    syncSource: "GITLAB_API" as const,
    webUrl: issue.web_url,
    assigneeId: assignee?.id ?? null,
  };

  return db.workItem.upsert({
    where: { gitlabId: issue.id },
    create: data,
    update: data,
  });
}

export class ReleaseEpicSyncService {
  async syncMonthlyReleaseEpics(): Promise<{
    epicsSynced: number;
    issuesSynced: number;
  }> {
    const { provider, config } = getProvider();
    const groupId = Number(config.groupId);

    const members = await db.teamMember.findMany({
      where: { isActive: true },
      select: { id: true, gitlabUserId: true, gitlabHandle: true },
    });

    const epics = await provider.listGroupEpics("all");
    const monthlyEpics = epics
      .map((epic) => ({
        epic,
        parsed: parseMonthlyReleaseEpicTitle(epic.title),
      }))
      .filter(
        (
          entry,
        ): entry is {
          epic: (typeof epics)[number];
          parsed: NonNullable<ReturnType<typeof parseMonthlyReleaseEpicTitle>>;
        } => entry.parsed !== null,
      );

    let epicsSynced = 0;
    let issuesSynced = 0;
    const now = new Date();

    for (const { epic, parsed } of monthlyEpics) {
      await db.releaseEpic.upsert({
        where: {
          gitlabGroupId_epicIid: {
            gitlabGroupId: groupId,
            epicIid: epic.iid,
          },
        },
        create: {
          gitlabGroupId: groupId,
          epicIid: epic.iid,
          workItemId: epic.work_item_id,
          title: epic.title,
          monthKey: parsed.monthKey,
          stream: parsed.stream,
          state: epic.state,
          webUrl: epic.web_url,
          description: epic.description,
          startDate: parseGitLabDate(epic.start_date),
          dueDate: parseGitLabDate(epic.due_date),
          lastSyncedAt: now,
        },
        update: {
          workItemId: epic.work_item_id,
          title: epic.title,
          monthKey: parsed.monthKey,
          stream: parsed.stream,
          state: epic.state,
          webUrl: epic.web_url,
          description: epic.description,
          startDate: parseGitLabDate(epic.start_date),
          dueDate: parseGitLabDate(epic.due_date),
          lastSyncedAt: now,
        },
      });
      epicsSynced += 1;

      const issues = await provider.listEpicIssues(epic.iid);
      for (const issue of issues) {
        await upsertEpicIssue(issue, epic.iid, members);
        issuesSynced += 1;
      }
    }

    logger.info("Monthly release epic sync completed", {
      epicsSynced,
      issuesSynced,
    });

    return { epicsSynced, issuesSynced };
  }

  async findEpicForStream(
    stream: ReleaseStream,
    monthKey?: string,
  ): Promise<{ epicIid: number; title: string; webUrl: string | null } | null> {
    const targetMonth = monthKey ?? currentMonthKeyFromDate();

    const epic = await db.releaseEpic.findFirst({
      where: {
        monthKey: targetMonth,
        stream,
        state: "opened",
      },
      orderBy: { epicIid: "desc" },
    });

    if (epic) {
      return {
        epicIid: epic.epicIid,
        title: epic.title,
        webUrl: epic.webUrl,
      };
    }

    try {
      const { provider } = getProvider();
      const epics = await provider.listGroupEpics("opened");
      const match = epics
        .map((entry) => ({
          entry,
          parsed: parseMonthlyReleaseEpicTitle(entry.title),
        }))
        .find(
          (item) =>
            item.parsed?.monthKey === targetMonth &&
            item.parsed.stream === stream,
        );

      if (!match) return null;

      return {
        epicIid: match.entry.iid,
        title: match.entry.title,
        webUrl: match.entry.web_url,
      };
    } catch {
      return null;
    }
  }
}

function currentMonthKeyFromDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export const releaseEpicSyncService = new ReleaseEpicSyncService();
