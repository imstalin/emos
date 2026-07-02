import type { RoadmapItem } from "@/domain/types/roadmap";
import type {
  RoadmapGitLabCreateResult,
  RoadmapGitLabIssuePreview,
} from "@/domain/types/roadmap-gitlab";
import { ADMIN_GITLAB_PROJECT_ID } from "@/domain/types/project-hygiene";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { logger } from "@/lib/logger";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import { roadmapService } from "@/server/services/roadmap/roadmap.service";

import {
  buildGitLabIssuePreview,
  resolveGitLabAssignee,
  resolveRoadmapReleaseStream,
} from "./roadmap-gitlab.mapper";
import { releaseEpicSyncService } from "@/server/services/releases/release-epic-sync.service";

function getProvider() {
  const config = getGitLabConfig();
  if (!config) {
    throw new Error("GitLab is not configured. Set GITLAB_URL and GITLAB_TOKEN.");
  }
  return createGitLabProvider(config);
}

async function findBacklogMilestoneId(projectId: number): Promise<{
  id: number | null;
  title: string | null;
}> {
  const provider = getProvider();
  const milestones = await provider.listProjectMilestones(projectId, "active");
  const backlog = milestones.find(
    (milestone) => milestone.title.trim().toLowerCase() === "backlog",
  );
  return {
    id: backlog?.id ?? null,
    title: backlog?.title ?? "Backlog",
  };
}

export async function previewGitLabIssue(
  item: RoadmapItem,
): Promise<RoadmapGitLabIssuePreview> {
  if (item.gitlab) {
    throw new Error(
      `This roadmap item is already linked to GitLab issue #${item.gitlab.issueIid}`,
    );
  }

  const provider = getProvider();
  const [project, members, milestone] = await Promise.all([
    provider.getProject(ADMIN_GITLAB_PROJECT_ID),
    provider.listGroupMembers(),
    findBacklogMilestoneId(ADMIN_GITLAB_PROJECT_ID),
  ]);

  const assignee = resolveGitLabAssignee(item.assignee, members);
  const stream = resolveRoadmapReleaseStream(item);
  const parentEpic = await releaseEpicSyncService.findEpicForStream(stream);

  return buildGitLabIssuePreview(item, {
    projectName: project.name,
    milestoneTitle: milestone.title,
    assignee,
    parentEpic,
  });
}

export async function createGitLabIssueById(
  itemId: string,
): Promise<RoadmapGitLabCreateResult> {
  const data = await roadmapService.getData();
  const item = data.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`Roadmap item not found: ${itemId}`);
  }
  if (itemId === "new") {
    throw new Error("Save the roadmap item before creating a GitLab issue");
  }
  return createGitLabIssueFromRoadmap(item);
}

export async function createGitLabIssueFromRoadmap(
  item: RoadmapItem,
): Promise<RoadmapGitLabCreateResult> {
  const preview = await previewGitLabIssue(item);
  const provider = getProvider();
  const members = await provider.listGroupMembers();
  const assignee = resolveGitLabAssignee(item.assignee, members);
  const milestone = await findBacklogMilestoneId(ADMIN_GITLAB_PROJECT_ID);

  const issue = await provider.createProjectIssue(ADMIN_GITLAB_PROJECT_ID, {
    title: preview.title,
    description: preview.description,
    labels: preview.labels.join(","),
    weight: preview.weight ?? undefined,
    milestone_id: milestone.id ?? undefined,
    assignee_ids: assignee ? [assignee.id] : undefined,
  });

  if (preview.parentEpicIid) {
    try {
      await provider.assignIssueToEpic(preview.parentEpicIid, issue.id);
    } catch (error) {
      logger.warn("Failed to assign roadmap issue to release epic", {
        epicIid: preview.parentEpicIid,
        issueId: issue.id,
        error,
      });
    }
  }

  const linkedItem: RoadmapItem = {
    ...item,
    gitlab: {
      projectId: ADMIN_GITLAB_PROJECT_ID,
      issueIid: issue.iid,
      issueUrl: issue.web_url,
      issueId: issue.id,
      createdAt: new Date().toISOString(),
    },
    hoursSpent: 0,
  };

  const { id, ...input } = linkedItem;
  const data = await roadmapService.updateItem(id, input);

  const updatedItem =
    data.items.find((entry) => entry.id === item.id) ?? linkedItem;

  return {
    item: updatedItem,
    issue: {
      iid: issue.iid,
      webUrl: issue.web_url,
      title: issue.title,
    },
  };
}

export async function refreshRoadmapHoursSpent(
  slug?: string,
): Promise<{ updated: number; totalHoursSpent: number }> {
  const data = await roadmapService.getData(slug);
  const provider = getProvider();
  let updated = 0;
  let totalHoursSpent = 0;

  const items = await Promise.all(
    data.items.map(async (item) => {
      if (!item.gitlab) return item;

      try {
        const stats = await provider.getIssueTimeStats(
          item.gitlab.projectId,
          item.gitlab.issueIid,
        );
        const hoursSpent = Math.round((stats.total_time_spent / 3600) * 10) / 10;
        updated += 1;
        totalHoursSpent += hoursSpent;
        return { ...item, hoursSpent };
      } catch {
        totalHoursSpent += item.hoursSpent ?? 0;
        return item;
      }
    }),
  );

  if (updated > 0) {
    await roadmapService.replaceItems(items, slug);
  } else {
    totalHoursSpent = items.reduce(
      (sum, item) => sum + (item.hoursSpent ?? 0),
      0,
    );
  }

  return { updated, totalHoursSpent };
}
