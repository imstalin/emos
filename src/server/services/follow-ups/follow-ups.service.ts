import type { Priority, WorkItemState } from "@prisma/client";

import type {
  FollowUpCategory,
  FollowUpItem,
  FollowUpPriority,
  FollowUpsDashboard,
} from "@/domain/types/follow-ups";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { governanceService } from "@/server/services/governance/governance.service";
import { getDemoFollowUpsDashboard } from "@/server/services/follow-ups/follow-ups-demo-data";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

const PRIORITY_ORDER: Record<FollowUpPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const EMPTY_CATEGORIES: Record<FollowUpCategory, number> = {
  blocked: 0,
  overdue: 0,
  stale_review: 0,
  stale_activity: 0,
  critical: 0,
  unassigned: 0,
  governance: 0,
  workload: 0,
};

type OpenWorkItem = {
  id: string;
  title: string;
  type: string;
  state: WorkItemState;
  priority: Priority;
  dueDate: Date | null;
  lastActivityAt: Date | null;
  webUrl: string | null;
  assigneeId: string | null;
  project: { name: string };
  assignee: { name: string } | null;
};

function daysSince(date: Date | null): number {
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function sortFollowUps(items: FollowUpItem[]): FollowUpItem[] {
  return [...items].sort((a, b) => {
    const priorityDiff =
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.title.localeCompare(b.title);
  });
}

function summarize(items: FollowUpItem[]): Omit<FollowUpsDashboard, "generatedAt" | "items"> {
  const byCategory = { ...EMPTY_CATEGORIES };
  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const item of items) {
    byCategory[item.category] += 1;
    if (item.priority === "CRITICAL") byPriority.critical += 1;
    if (item.priority === "HIGH") byPriority.high += 1;
    if (item.priority === "MEDIUM") byPriority.medium += 1;
    if (item.priority === "LOW") byPriority.low += 1;
  }

  return { total: items.length, byCategory, byPriority };
}

export class FollowUpsService {
  async getDashboard(): Promise<FollowUpsDashboard> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo follow-ups — database unavailable");
      return getDemoFollowUpsDashboard();
    }

    try {
      const workItemCount = await db.workItem.count();
      if (workItemCount === 0) {
        return getDemoFollowUpsDashboard();
      }

      return await this.buildFromDatabase();
    } catch (error) {
      logger.error("Failed to load follow-ups", { error });
      return getDemoFollowUpsDashboard();
    }
  }

  private async buildFromDatabase(): Promise<FollowUpsDashboard> {
    const monitoredWhere = await buildMonitoredProjectWhere();
    const activeFilter = mergeWorkItemWhere(
      { state: { notIn: ["DONE", "CLOSED"] } },
      monitoredWhere,
    );

    const [workItems, members, governance] = await Promise.all([
      db.workItem.findMany({
        where: activeFilter,
        include: {
          project: { select: { name: true } },
          assignee: { select: { name: true } },
        },
        orderBy: [{ priority: "asc" }, { lastActivityAt: "desc" }],
      }),
      db.teamMember.findMany({
        where: { isActive: true },
        include: {
          workItems: {
            where: activeFilter,
          },
        },
      }),
      governanceService.getReport(),
    ]);

    const items: FollowUpItem[] = [
      ...this.fromWorkItems(workItems),
      ...this.fromGovernance(governance.violations),
      ...this.fromWorkload(members),
    ];

    const sorted = sortFollowUps(items);

    return {
      generatedAt: new Date().toISOString(),
      ...summarize(sorted),
      items: sorted,
    };
  }

  private fromWorkItems(workItems: OpenWorkItem[]): FollowUpItem[] {
    const items: FollowUpItem[] = [];

    for (const item of workItems) {
      const base = {
        workItemId: item.id,
        workItemTitle: item.title,
        assigneeName: item.assignee?.name ?? null,
        projectName: item.project.name,
        webUrl: item.webUrl,
        dueDate: item.dueDate?.toISOString() ?? null,
        lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
      };

      if (item.state === "BLOCKED") {
        items.push({
          id: `blocked-${item.id}`,
          category: "blocked",
          priority: "CRITICAL",
          title: `Blocked: ${item.title}`,
          reason: "Work item is marked blocked and needs escalation.",
          suggestedAction:
            "Check in with the assignee, identify the blocker owner, and set a resolution ETA.",
          ...base,
        });
        continue;
      }

      if (item.dueDate && item.dueDate.getTime() < Date.now()) {
        items.push({
          id: `overdue-${item.id}`,
          category: "overdue",
          priority: item.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
          title: `Overdue: ${item.title}`,
          reason: "Due date has passed without completion.",
          suggestedAction:
            "Confirm whether the due date should move or if scope needs to be reduced.",
          ...base,
        });
      }

      if (item.state === "IN_REVIEW" && daysSince(item.lastActivityAt) >= 3) {
        items.push({
          id: `stale-review-${item.id}`,
          category: "stale_review",
          priority: "MEDIUM",
          title: `Stale review: ${item.title}`,
          reason: "Merge request or review has had no activity for 3+ days.",
          suggestedAction:
            "Ping reviewers and confirm review capacity for today.",
          ...base,
        });
      }

      if (
        item.state === "IN_PROGRESS" &&
        daysSince(item.lastActivityAt) >= 5
      ) {
        items.push({
          id: `stale-activity-${item.id}`,
          category: "stale_activity",
          priority: "MEDIUM",
          title: `Inactive: ${item.title}`,
          reason: "No GitLab activity for 5+ days while in progress.",
          suggestedAction:
            "Ask for a status update and confirm the item is still actively owned.",
          ...base,
        });
      }

      if (item.priority === "CRITICAL") {
        items.push({
          id: `critical-${item.id}`,
          category: "critical",
          priority: "HIGH",
          title: `Critical priority: ${item.title}`,
          reason: "Open item flagged as critical priority.",
          suggestedAction:
            "Validate urgency, assign a clear owner, and confirm daily progress until resolved.",
          ...base,
        });
      }

      if (
        !item.assigneeId &&
        (item.priority === "HIGH" || item.priority === "CRITICAL")
      ) {
        items.push({
          id: `unassigned-${item.id}`,
          category: "unassigned",
          priority: "HIGH",
          title: `Unassigned high priority: ${item.title}`,
          reason: "High-priority work item has no assignee in EMOS.",
          suggestedAction:
            "Assign an owner in GitLab and confirm capacity with the engineer.",
          ...base,
        });
      }
    }

    return items;
  }

  private fromGovernance(
    violations: Array<{
      ruleSlug: string;
      ruleName: string;
      severity: string;
      workItemId: string;
      workItemTitle: string;
      assigneeName: string | null;
      projectName: string;
      webUrl: string | null;
    }>,
  ): FollowUpItem[] {
    return violations
      .filter((violation) => violation.severity === "error")
      .slice(0, 25)
      .map((violation) => ({
        id: `governance-${violation.ruleSlug}-${violation.workItemId}`,
        category: "governance" as const,
        priority:
          violation.severity === "error"
            ? ("HIGH" as FollowUpPriority)
            : ("MEDIUM" as FollowUpPriority),
        title: `${violation.ruleName}: ${violation.workItemTitle}`,
        reason: "Governance rule violation detected on open work item.",
        suggestedAction:
          "Review the rule violation with the assignee and agree on a fix timeline.",
        workItemId: violation.workItemId,
        workItemTitle: violation.workItemTitle,
        assigneeName: violation.assigneeName,
        projectName: violation.projectName,
        webUrl: violation.webUrl,
        dueDate: null,
        lastActivityAt: null,
      }));
  }

  private fromWorkload(
    members: Array<{
      id: string;
      name: string;
      capacity: number;
      workItems: Array<{ storyPoints: number | null }>;
    }>,
  ): FollowUpItem[] {
    const items: FollowUpItem[] = [];

    for (const member of members) {
      const assignedPoints = member.workItems.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      );

      if (assignedPoints <= member.capacity * 0.5) continue;

      items.push({
        id: `workload-${member.id}`,
        category: "workload",
        priority: assignedPoints > member.capacity ? "HIGH" : "MEDIUM",
        title: `Overloaded: ${member.name}`,
        reason: `${assignedPoints} story points assigned against ${member.capacity} capacity.`,
        suggestedAction:
          "Rebalance sprint scope or defer lower-priority items with the engineer.",
        workItemId: null,
        workItemTitle: null,
        assigneeName: member.name,
        projectName: null,
        webUrl: null,
        dueDate: null,
        lastActivityAt: null,
      });
    }

    return items;
  }

  async getItemById(id: string): Promise<FollowUpItem | null> {
    const dashboard = await this.getDashboard();
    return dashboard.items.find((item) => item.id === id) ?? null;
  }
}

export const followUpsService = new FollowUpsService();
