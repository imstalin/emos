import { subWeeks } from "date-fns";

import type { TimesheetsReport } from "@/domain/types/timesheets";
import { getDemoTeamDashboard } from "@/server/services/team/team-demo-data";

export function getDemoTimesheetsReport(weekOffset: number): TimesheetsReport {
  const team = getDemoTeamDashboard();
  const now = new Date();
  const weekStart = subWeeks(now, -weekOffset);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const members = team.members.map((member) => {
    const entries = member.assignedItems.slice(0, 4).map((item, index) => ({
      workItemId: `${item.id}-${index}`,
      title: item.title,
      type: item.type,
      projectName: item.projectName,
      storyPoints: index === 0 ? 3 : null,
      inferredHours: index === 0 ? 12 : item.type === "MERGE_REQUEST" ? 3 : 2,
      activityType: "assigned" as const,
      lastActivityAt: new Date(
        weekStart.getTime() + index * 24 * 60 * 60 * 1000,
      ).toISOString(),
      webUrl: item.webUrl,
    }));

    const inferredHours = entries.reduce(
      (sum, entry) => sum + entry.inferredHours,
      0,
    );

    return {
      memberId: member.id,
      name: member.name,
      role: member.role,
      capacityHours: member.capacity,
      inferredHours,
      utilizationPercent:
        member.capacity > 0
          ? Math.min(100, Math.round((inferredHours / member.capacity) * 100))
          : 0,
      entryCount: entries.length,
      entries,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    weekLabel: "Demo week",
    weekOffset,
    totalInferredHours: members.reduce(
      (sum, member) => sum + member.inferredHours,
      0,
    ),
    totalCapacityHours: members.reduce(
      (sum, member) => sum + member.capacityHours,
      0,
    ),
    membersWithActivity: members.filter((member) => member.entryCount > 0).length,
    members,
  };
}
