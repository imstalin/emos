import {
  endOfWeek,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns";

import type {
  MemberTimesheet,
  TimesheetEntry,
  TimesheetsReport,
} from "@/domain/types/timesheets";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDemoTimesheetsReport } from "@/server/services/timesheets/timesheets-demo-data";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

const HOURS_PER_POINT = 4;
const DEFAULT_ISSUE_HOURS = 2;
const DEFAULT_MR_HOURS = 3;
const REVIEW_HOURS = 1;

function getWeekRange(weekOffset: number) {
  const reference = subWeeks(new Date(), -weekOffset);
  const weekStart = startOfWeek(reference, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(reference, { weekStartsOn: 1 });

  return {
    weekStart,
    weekEnd,
    weekLabel: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`,
  };
}

function inferHours(params: {
  storyPoints: number | null;
  type: string;
  asReviewer: boolean;
}): number {
  if (params.asReviewer) return REVIEW_HOURS;
  if (params.storyPoints != null) return params.storyPoints * HOURS_PER_POINT;
  return params.type === "MERGE_REQUEST" ? DEFAULT_MR_HOURS : DEFAULT_ISSUE_HOURS;
}

function isWithinWeek(date: Date | null, weekStart: Date, weekEnd: Date): boolean {
  if (!date) return false;
  return date >= weekStart && date <= weekEnd;
}

export class TimesheetsService {
  async getReport(weekOffset = 0): Promise<TimesheetsReport> {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      logger.info("Using demo timesheets — database unavailable");
      return getDemoTimesheetsReport(weekOffset);
    }

    try {
      const memberCount = await db.teamMember.count({ where: { isActive: true } });
      if (memberCount === 0) {
        return getDemoTimesheetsReport(weekOffset);
      }

      return await this.buildFromDatabase(weekOffset);
    } catch (error) {
      logger.error("Failed to load timesheets", { error });
      return getDemoTimesheetsReport(weekOffset);
    }
  }

  private async buildFromDatabase(weekOffset: number): Promise<TimesheetsReport> {
    const { weekStart, weekEnd, weekLabel } = getWeekRange(weekOffset);

    const monitoredWhere = await buildMonitoredProjectWhere();

    const members = await db.teamMember.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    const workItems = await db.workItem.findMany({
      where: mergeWorkItemWhere(
        {
          OR: [
            { lastActivityAt: { gte: weekStart, lte: weekEnd } },
            { updatedAt: { gte: weekStart, lte: weekEnd } },
          ],
        },
        monitoredWhere,
      ),
      include: {
        project: { select: { name: true } },
      },
    });

    const memberTimesheets: MemberTimesheet[] = members.map((member) => {
      const entries: TimesheetEntry[] = [];

      for (const item of workItems) {
        const activityAt = item.lastActivityAt ?? item.updatedAt;
        if (!isWithinWeek(activityAt, weekStart, weekEnd)) continue;

        if (item.assigneeId === member.id) {
          entries.push({
            workItemId: item.id,
            title: item.title,
            type: item.type,
            projectName: item.project.name,
            storyPoints: item.storyPoints,
            inferredHours: inferHours({
              storyPoints: item.storyPoints,
              type: item.type,
              asReviewer: false,
            }),
            activityType: "assigned",
            lastActivityAt: activityAt.toISOString(),
            webUrl: item.webUrl,
          });
        }

        if (item.reviewerId === member.id && item.assigneeId !== member.id) {
          entries.push({
            workItemId: `${item.id}-review`,
            title: `Review: ${item.title}`,
            type: item.type,
            projectName: item.project.name,
            storyPoints: null,
            inferredHours: REVIEW_HOURS,
            activityType: "review",
            lastActivityAt: activityAt.toISOString(),
            webUrl: item.webUrl,
          });
        }
      }

      entries.sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime(),
      );

      const inferredHours = entries.reduce(
        (sum, entry) => sum + entry.inferredHours,
        0,
      );
      const capacityHours = member.capacity;

      return {
        memberId: member.id,
        name: member.name,
        role: member.role,
        capacityHours,
        inferredHours,
        utilizationPercent:
          capacityHours > 0
            ? Math.min(100, Math.round((inferredHours / capacityHours) * 100))
            : 0,
        entryCount: entries.length,
        entries,
      };
    });

    const activeMembers = memberTimesheets.filter(
      (member) => member.entryCount > 0,
    );

    return {
      generatedAt: new Date().toISOString(),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weekLabel,
      weekOffset,
      totalInferredHours: memberTimesheets.reduce(
        (sum, member) => sum + member.inferredHours,
        0,
      ),
      totalCapacityHours: memberTimesheets.reduce(
        (sum, member) => sum + member.capacityHours,
        0,
      ),
      membersWithActivity: activeMembers.length,
      members: memberTimesheets,
    };
  }
}

export const timesheetsService = new TimesheetsService();
