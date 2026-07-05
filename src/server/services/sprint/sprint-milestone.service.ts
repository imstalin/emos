import type { FiscalYearSprintPlan } from "@/domain/sprint/fiscal-year-sprints";
import { buildPhoenixGroupSprintPlan } from "@/domain/sprint/fiscal-year-sprints";
import { db } from "@/lib/db";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";

export interface SprintMilestonePreviewItem {
  number: number;
  title: string;
  startDate: string;
  dueDate: string;
  status: "exists" | "to_create";
  existingMilestoneId?: number;
}

export interface SprintMilestonePreview {
  groupId: string;
  groupName: string;
  groupPath: string;
  plan: FiscalYearSprintPlan;
  namingFormat: string;
  items: SprintMilestonePreviewItem[];
  toCreateCount: number;
  existingCount: number;
}

export interface SprintMilestoneCreateResult {
  created: Array<{
    title: string;
    milestoneId: number;
  }>;
  skipped: Array<{
    title: string;
    reason: string;
  }>;
  closed: Array<{
    title: string;
    milestoneId: number;
    dueDate: string | null;
  }>;
}

export interface SprintDbSyncResult {
  teamId: string;
  upserted: number;
  activeSprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  workItemsLinked: number;
  deactivatedLegacySprints: number;
}

const PROTECTED_MILESTONE_TITLES = new Set([
  "sprint backlog",
  "backlog",
]);

function isExpiredMilestone(
  milestone: { due_date?: string | null; expired?: boolean; state: string },
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (milestone.state !== "active") return false;
  if (milestone.expired) return true;
  if (!milestone.due_date) return false;
  return milestone.due_date < today;
}

function parseSprintStartDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function parseSprintEndDate(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function pickActiveSprint<T extends { id: string; name: string; startDate: Date; endDate: Date }>(
  sprints: T[],
  today = new Date().toISOString().slice(0, 10),
): T | null {
  const current = sprints.find((sprint) => {
    const start = sprint.startDate.toISOString().slice(0, 10);
    const end = sprint.endDate.toISOString().slice(0, 10);
    return start <= today && end >= today;
  });
  if (current) return current;

  return (
    sprints.find(
      (sprint) => sprint.startDate.toISOString().slice(0, 10) > today,
    ) ?? null
  );
}

export class SprintMilestoneService {
  async preview(options?: {
    startDate?: string;
    endDate?: string;
    startingSprintNumber?: number;
  }): Promise<SprintMilestonePreview> {
    const config = getGitLabConfig();
    if (!config) {
      throw new Error("GitLab is not configured");
    }

    const provider = createGitLabProvider(config);
    const group = await provider.getGroup(Number(config.groupId));

    const plan = buildPhoenixGroupSprintPlan({
      startDate: options?.startDate ?? "2026-07-06",
      endDate: options?.endDate ?? "2027-06-30",
      startingSprintNumber: options?.startingSprintNumber ?? 1,
      titleFormat: "month_sprint_number",
      cadence: "biweekly_friday",
    });

    const existingMilestones = await provider.listGroupMilestones(
      Number(config.groupId),
      "all",
    );
    const existingByTitle = new Map(
      existingMilestones.map((milestone) => [
        milestone.title.trim().toLowerCase(),
        milestone,
      ]),
    );

    let toCreateCount = 0;
    let existingCount = 0;

    const items: SprintMilestonePreviewItem[] = plan.sprints.map((sprint) => {
      const existing = existingByTitle.get(sprint.title.trim().toLowerCase());
      if (existing) {
        existingCount += 1;
        return {
          number: sprint.number,
          title: sprint.title,
          startDate: sprint.startDate,
          dueDate: sprint.dueDate,
          status: "exists" as const,
          existingMilestoneId: existing.id,
        };
      }

      toCreateCount += 1;
      return {
        number: sprint.number,
        title: sprint.title,
        startDate: sprint.startDate,
        dueDate: sprint.dueDate,
        status: "to_create" as const,
      };
    });

    return {
      groupId: config.groupId,
      groupName: group.name,
      groupPath: group.full_path,
      plan,
      namingFormat: "{Mon} - Sprint {n}",
      items,
      toCreateCount,
      existingCount,
    };
  }

  async closeExpiredGroupMilestones(): Promise<SprintMilestoneCreateResult["closed"]> {
    const config = getGitLabConfig();
    if (!config) {
      throw new Error("GitLab is not configured");
    }

    const provider = createGitLabProvider(config);
    const groupId = Number(config.groupId);
    const milestones = await provider.listGroupMilestones(groupId, "active");
    const closed: SprintMilestoneCreateResult["closed"] = [];

    for (const milestone of milestones) {
      const titleKey = milestone.title.trim().toLowerCase();
      if (PROTECTED_MILESTONE_TITLES.has(titleKey)) continue;
      if (!isExpiredMilestone(milestone)) continue;

      await provider.updateGroupMilestone(groupId, milestone.id, {
        state_event: "close",
      });

      closed.push({
        title: milestone.title,
        milestoneId: milestone.id,
        dueDate: milestone.due_date ?? null,
      });
    }

    return closed;
  }

  async syncFiscalYearMilestones(options?: {
    startDate?: string;
    endDate?: string;
    startingSprintNumber?: number;
    cadence?: "calendar_days" | "biweekly_friday";
    confirm?: boolean;
  }): Promise<SprintMilestoneCreateResult & { updated: Array<{ title: string; milestoneId: number; startDate: string; dueDate: string }> }> {
    if (!options?.confirm) {
      throw new Error("Sync requires explicit confirmation");
    }

    const config = getGitLabConfig();
    if (!config) {
      throw new Error("GitLab is not configured");
    }

    const provider = createGitLabProvider(config);
    const groupId = Number(config.groupId);
    const plan = buildPhoenixGroupSprintPlan({
      startDate: options?.startDate ?? "2026-07-06",
      endDate: options?.endDate ?? "2027-06-30",
      startingSprintNumber: options?.startingSprintNumber ?? 1,
      titleFormat: "month_sprint_number",
      cadence: options?.cadence ?? "biweekly_friday",
    });

    const activeMilestones = await provider.listGroupMilestones(groupId, "active");
    const activeByTitle = new Map(
      activeMilestones.map((milestone) => [
        milestone.title.trim().toLowerCase(),
        milestone,
      ]),
    );

    const plannedTitles = new Set(
      plan.sprints.map((sprint) => sprint.title.trim().toLowerCase()),
    );

    const updated: Array<{
      title: string;
      milestoneId: number;
      startDate: string;
      dueDate: string;
    }> = [];
    const created: SprintMilestoneCreateResult["created"] = [];
    const skipped: SprintMilestoneCreateResult["skipped"] = [];

    for (const sprint of plan.sprints) {
      const existing = activeByTitle.get(sprint.title.trim().toLowerCase());

      if (existing) {
        const milestone = await provider.updateGroupMilestone(groupId, existing.id, {
          start_date: sprint.startDate,
          due_date: sprint.dueDate,
          description: `${plan.fiscalYearLabel} · ${sprint.startDate} to ${sprint.dueDate} (bi-weekly, ends Friday)`,
        });
        updated.push({
          title: sprint.title,
          milestoneId: milestone.id,
          startDate: sprint.startDate,
          dueDate: sprint.dueDate,
        });
        continue;
      }

      const milestone = await provider.createGroupMilestone(groupId, {
        title: sprint.title,
        description: `${plan.fiscalYearLabel} · ${sprint.startDate} to ${sprint.dueDate} (bi-weekly, ends Friday)`,
        start_date: sprint.startDate,
        due_date: sprint.dueDate,
      });
      created.push({ title: sprint.title, milestoneId: milestone.id });
    }

    const closed: SprintMilestoneCreateResult["closed"] = [];
    for (const milestone of activeMilestones) {
      const titleKey = milestone.title.trim().toLowerCase();
      if (PROTECTED_MILESTONE_TITLES.has(titleKey)) continue;
      if (plannedTitles.has(titleKey)) continue;
      if (!isExpiredMilestone(milestone) && /sprint/i.test(milestone.title)) {
        await provider.updateGroupMilestone(groupId, milestone.id, {
          state_event: "close",
        });
        closed.push({
          title: milestone.title,
          milestoneId: milestone.id,
          dueDate: milestone.due_date ?? null,
        });
      }
    }

    return { created, updated, skipped, closed };
  }

  async syncToSprintsTable(options?: {
    teamSlug?: string;
    startDate?: string;
    endDate?: string;
    startingSprintNumber?: number;
  }): Promise<SprintDbSyncResult> {
    const preview = await this.preview(options);
    const team = await db.team.findFirst({
      where: { slug: options?.teamSlug ?? "engineering" },
    });
    if (!team) {
      throw new Error(`Team not found: ${options?.teamSlug ?? "engineering"}`);
    }

    const syncedSprints: Array<{
      id: string;
      name: string;
      gitlabMilestoneId: number;
      startDate: Date;
      endDate: Date;
    }> = [];

    for (const item of preview.items) {
      if (!item.existingMilestoneId) continue;

      const sprint = await db.sprint.upsert({
        where: { gitlabMilestoneId: item.existingMilestoneId },
        update: {
          name: item.title,
          startDate: parseSprintStartDate(item.startDate),
          endDate: parseSprintEndDate(item.dueDate),
        },
        create: {
          teamId: team.id,
          name: item.title,
          gitlabMilestoneId: item.existingMilestoneId,
          startDate: parseSprintStartDate(item.startDate),
          endDate: parseSprintEndDate(item.dueDate),
          isActive: false,
        },
      });

      syncedSprints.push({
        id: sprint.id,
        name: sprint.name,
        gitlabMilestoneId: item.existingMilestoneId,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      });
    }

    const active = pickActiveSprint(syncedSprints);
    await db.sprint.updateMany({ data: { isActive: false } });
    if (active) {
      await db.sprint.update({
        where: { id: active.id },
        data: { isActive: true },
      });
    }

    let workItemsLinked = 0;
    for (const sprint of syncedSprints) {
      const result = await db.workItem.updateMany({
        where: {
          OR: [
            { milestoneId: sprint.gitlabMilestoneId },
            { milestoneTitle: sprint.name },
          ],
        },
        data: { sprintId: sprint.id },
      });
      workItemsLinked += result.count;
    }

    const deactivatedLegacySprints = await db.sprint.updateMany({
      where: { gitlabMilestoneId: null },
      data: { isActive: false },
    });

    return {
      teamId: team.id,
      upserted: syncedSprints.length,
      activeSprint: active
        ? {
            id: active.id,
            name: active.name,
            startDate: active.startDate.toISOString(),
            endDate: active.endDate.toISOString(),
          }
        : null,
      workItemsLinked,
      deactivatedLegacySprints: deactivatedLegacySprints.count,
    };
  }

  async createConfirmed(options?: {
    startDate?: string;
    endDate?: string;
    startingSprintNumber?: number;
    confirm?: boolean;
    closeExpired?: boolean;
  }): Promise<SprintMilestoneCreateResult> {
    if (!options?.confirm) {
      throw new Error("Creation requires explicit confirmation");
    }

    const preview = await this.preview(options);
    const config = getGitLabConfig();
    if (!config) {
      throw new Error("GitLab is not configured");
    }

    const provider = createGitLabProvider(config);
    const groupId = Number(config.groupId);
    const created: SprintMilestoneCreateResult["created"] = [];
    const skipped: SprintMilestoneCreateResult["skipped"] = [];
    const closed =
      options.closeExpired === false
        ? []
        : await this.closeExpiredGroupMilestones();

    for (const item of preview.items) {
      if (item.status === "exists") {
        skipped.push({ title: item.title, reason: "Already exists at group level" });
        continue;
      }

      const milestone = await provider.createGroupMilestone(groupId, {
        title: item.title,
        description: `${preview.plan.fiscalYearLabel} · ${item.startDate} to ${item.dueDate}`,
        start_date: item.startDate,
        due_date: item.dueDate,
      });

      created.push({
        title: item.title,
        milestoneId: milestone.id,
      });
    }

    return { created, skipped, closed };
  }
}

export const sprintMilestoneService = new SprintMilestoneService();
