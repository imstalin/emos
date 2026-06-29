import type { WorkItemSummary } from "@/domain/types/dashboard";
import type { TeamDashboardData, TeamMemberDetail } from "@/domain/types/team";
import { getDemoDashboardMetrics } from "@/server/services/dashboard/demo-data";

export function getDemoTeamDashboard(): TeamDashboardData {
  const metrics = getDemoDashboardMetrics();
  const workItemsByAssignee = new Map<string, WorkItemSummary[]>();

  for (const item of [
    ...metrics.currentWork,
    ...metrics.blockers,
    ...metrics.highPriority,
    ...metrics.pendingReviews,
    ...metrics.qaStatus.items,
    ...metrics.productionIssues,
  ]) {
    if (!item.assigneeName) continue;
    const list = workItemsByAssignee.get(item.assigneeName) ?? [];
    if (!list.some((existing) => existing.id === item.id)) {
      list.push(item);
    }
    workItemsByAssignee.set(item.assigneeName, list);
  }

  const members: TeamMemberDetail[] = metrics.workload.map((member) => {
    const assignedItems = workItemsByAssignee.get(member.name) ?? [];
    const reviewItems = metrics.pendingReviews.filter(
      (item) => item.assigneeName !== member.name,
    ).slice(0, 2);

    const utilizationPercent =
      member.capacity > 0
        ? Math.min(100, Math.round((member.assignedPoints / member.capacity) * 100))
        : 0;

    return {
      ...member,
      gitlabHandle: member.name.split(" ")[0]?.toLowerCase() ?? null,
      blockedCount: assignedItems.filter((item) => item.state === "BLOCKED").length,
      inReviewCount: assignedItems.filter((item) => item.state === "IN_REVIEW").length,
      inQaCount: assignedItems.filter((item) => item.state === "QA").length,
      mergeRequestCount: assignedItems.filter(
        (item) => item.type === "MERGE_REQUEST",
      ).length,
      issueCount: assignedItems.filter((item) => item.type === "ISSUE").length,
      utilizationPercent,
      assignedItems,
      reviewItems,
    };
  });

  return {
    generatedAt: metrics.generatedAt,
    sprint: metrics.sprintHealth,
    teamCapacity: metrics.teamCapacity,
    members,
    unassigned: { count: 0, items: [] },
    filters: {
      developers: metrics.teamStatus.developers,
      qaMembers: metrics.teamStatus.qaMembers,
    },
  };
}
