import type { FollowUpsDashboard } from "@/domain/types/follow-ups";
import { getDemoDashboardMetrics } from "@/server/services/dashboard/demo-data";

export function getDemoFollowUpsDashboard(): FollowUpsDashboard {
  const metrics = getDemoDashboardMetrics();

  const items = [
    ...metrics.blockers.map((item) => ({
      id: `blocked-${item.id}`,
      category: "blocked" as const,
      priority: "CRITICAL" as const,
      title: `Blocked: ${item.title}`,
      reason: "Work item is marked blocked and needs escalation.",
      suggestedAction:
        "Check in with the assignee and identify the blocker owner.",
      workItemId: item.id,
      workItemTitle: item.title,
      assigneeName: item.assigneeName,
      projectName: item.projectName,
      webUrl: item.webUrl,
      dueDate: item.dueDate,
      lastActivityAt: null,
    })),
    ...metrics.highPriority.slice(0, 3).map((item) => ({
      id: `critical-${item.id}`,
      category: "critical" as const,
      priority: "HIGH" as const,
      title: `Critical priority: ${item.title}`,
      reason: "Open item flagged as critical priority.",
      suggestedAction:
        "Validate urgency and confirm daily progress until resolved.",
      workItemId: item.id,
      workItemTitle: item.title,
      assigneeName: item.assigneeName,
      projectName: item.projectName,
      webUrl: item.webUrl,
      dueDate: item.dueDate,
      lastActivityAt: null,
    })),
    ...metrics.pendingReviews.slice(0, 2).map((item) => ({
      id: `stale-review-${item.id}`,
      category: "stale_review" as const,
      priority: "MEDIUM" as const,
      title: `Stale review: ${item.title}`,
      reason: "Review has been pending without recent activity.",
      suggestedAction: "Ping reviewers and confirm review capacity.",
      workItemId: item.id,
      workItemTitle: item.title,
      assigneeName: item.assigneeName,
      projectName: item.projectName,
      webUrl: item.webUrl,
      dueDate: item.dueDate,
      lastActivityAt: null,
    })),
  ];

  const byCategory = {
    blocked: items.filter((item) => item.category === "blocked").length,
    overdue: 0,
    stale_review: items.filter((item) => item.category === "stale_review").length,
    stale_activity: 0,
    critical: items.filter((item) => item.category === "critical").length,
    unassigned: 0,
    governance: 0,
    workload: 0,
  };

  const byPriority = {
    critical: items.filter((item) => item.priority === "CRITICAL").length,
    high: items.filter((item) => item.priority === "HIGH").length,
    medium: items.filter((item) => item.priority === "MEDIUM").length,
    low: 0,
  };

  return {
    generatedAt: metrics.generatedAt,
    total: items.length,
    byCategory,
    byPriority,
    items,
  };
}
