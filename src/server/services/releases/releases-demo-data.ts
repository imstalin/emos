import type { ReleasesDashboard } from "@/domain/types/releases";
import { getDemoDashboardMetrics } from "@/server/services/dashboard/demo-data";

export function getDemoReleasesDashboard(): ReleasesDashboard {
  const metrics = getDemoDashboardMetrics();

  const releases = metrics.releaseHealth.map((release) => ({
    ...release,
    description: null,
    isDraft: false,
    releasedAt: null,
    projectId: release.id,
    totalItems: release.openItems + Math.round(release.openItems * 0.4),
    doneItems: Math.round(release.openItems * 0.4),
    inReviewItems: Math.min(3, release.openItems),
    qaItems: Math.min(2, release.openItems),
    criticalItems: release.blockedItems,
    checklist: [
      {
        id: "blockers",
        label: "No blockers",
        status: release.blockedItems === 0 ? ("complete" as const) : ("at_risk" as const),
        detail:
          release.blockedItems === 0
            ? "No blocked work items"
            : `${release.blockedItems} blocked items`,
      },
      {
        id: "critical",
        label: "Critical items cleared",
        status: release.blockedItems === 0 ? ("complete" as const) : ("at_risk" as const),
        detail: "Demo release checklist",
      },
      {
        id: "review",
        label: "Code review complete",
        status: "at_risk" as const,
        detail: "3 items in review",
      },
      {
        id: "qa",
        label: "QA sign-off",
        status: "pending" as const,
        detail: "2 items in QA",
      },
    ],
    workItems: metrics.highPriority
      .filter((item) => item.projectName === release.projectName)
      .slice(0, 5),
  }));

  return {
    generatedAt: metrics.generatedAt,
    activeSprint: metrics.sprintHealth,
    sprintWorkItems: metrics.currentWork.slice(0, 8),
    releases,
    summary: {
      upcoming: releases.length,
      draft: 0,
      atRisk: releases.filter(
        (release) => release.health === "AT_RISK" || release.health === "CRITICAL",
      ).length,
    },
  };
}
