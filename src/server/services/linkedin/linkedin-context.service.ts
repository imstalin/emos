import type {
  LinkedInContextSummary,
  LinkedInTimeRange,
} from "@/domain/types/linkedin-pm";
import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";
import { gitlabActivityService } from "@/server/services/gitlab/gitlab-activity.service";
import { governanceService } from "@/server/services/governance/governance.service";
import { releasesService } from "@/server/services/releases/releases.service";
import { roadmapService } from "@/server/services/roadmap/roadmap.service";
import { teamDashboardService } from "@/server/services/team/team-dashboard.service";

function timeRangeToDays(range: LinkedInTimeRange): number {
  switch (range) {
    case "week":
      return 7;
    case "month":
      return 30;
    case "quarter":
      return 90;
  }
}

function anonymizeName(name: string | null | undefined, enabled: boolean): string {
  if (!name) return "Unassigned";
  if (!enabled) return name;
  return "a team member";
}

export async function buildLinkedInContextSummary(
  timeRange: LinkedInTimeRange,
  anonymizeTeam: boolean,
): Promise<LinkedInContextSummary> {
  const [followUps, team, releases, governance, roadmap, activity] =
    await Promise.all([
      followUpsService.getDashboard(),
      teamDashboardService.getDashboard(),
      releasesService.getDashboard(),
      governanceService.getReport(),
      roadmapService.getData(),
      gitlabActivityService.getActivity({ limit: 30, page: 1 }),
    ]);

  const days = timeRangeToDays(timeRange);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const recentActivity = activity.items.filter((item) => {
    if (!item.lastActivityAt) return true;
    return new Date(item.lastActivityAt).getTime() >= cutoff;
  });

  const doneRecent = recentActivity.filter(
    (item) => item.state === "DONE" || item.state === "CLOSED",
  );
  const inProgress = recentActivity.filter(
    (item) => item.state === "IN_PROGRESS" || item.state === "IN_REVIEW",
  );

  const releaseGroup = releases.monthlyReleases[0];
  const releaseHeadline = releaseGroup
    ? `${releaseGroup.label}: ${releaseGroup.progressPercent}% complete, ${releaseGroup.totalSpentHours}h logged across epics`
    : releases.releases[0]
      ? `Release v${releases.releases[0].version} at ${releases.releases[0].progressPercent}%`
      : null;

  const roadmapThemes = roadmap.items
    .filter((item) => item.include === "Yes")
    .slice(0, 8)
    .map(
      (item) =>
        `${item.quarter} · ${item.category}: ${item.title} (${item.priority})`,
    );

  const highlights: string[] = [];

  if (team.sprint) {
    highlights.push(
      `Active sprint "${team.sprint.name}": ${team.sprint.completedPoints}/${team.sprint.totalPoints} points, ${team.sprint.daysRemaining} days remaining`,
    );
  }

  if (releaseHeadline) {
    highlights.push(`Release status: ${releaseHeadline}`);
  }

  if (doneRecent.length > 0) {
    highlights.push(
      `${doneRecent.length} work items completed in the selected period`,
    );
    for (const item of doneRecent.slice(0, 5)) {
      highlights.push(
        `Completed: ${item.title} (${item.projectName})`,
      );
    }
  }

  if (inProgress.length > 0) {
    highlights.push(`${inProgress.length} items actively in progress or review`);
    for (const item of inProgress.slice(0, 4)) {
      highlights.push(
        `In flight: ${item.title} — ${anonymizeName(item.assigneeName, anonymizeTeam)}`,
      );
    }
  }

  const criticalFollowUps = followUps.items.filter(
    (item) => item.priority === "CRITICAL" || item.priority === "HIGH",
  );
  if (criticalFollowUps.length > 0) {
    highlights.push(
      `${criticalFollowUps.length} high-priority follow-ups need attention`,
    );
  }

  if (team.teamCapacity.utilizationPercent > 0) {
    highlights.push(
      `Team utilization at ${team.teamCapacity.utilizationPercent}% (${team.teamCapacity.membersOverCapacity} members over recommended load)`,
    );
  }

  highlights.push(
    `Governance score ${governance.score}/100 with ${governance.violationCount} open violations`,
  );

  if (roadmapThemes.length > 0) {
    highlights.push(`FY roadmap themes in focus:`);
    highlights.push(...roadmapThemes.slice(0, 5).map((theme) => `  · ${theme}`));
  }

  return {
    generatedAt: new Date().toISOString(),
    timeRange,
    highlights,
    stats: {
      recentActivityCount: recentActivity.length,
      openFollowUps: followUps.total,
      criticalFollowUps: criticalFollowUps.length,
      teamUtilization: team.teamCapacity.utilizationPercent ?? null,
      releaseHeadline,
      roadmapThemes: roadmapThemes.slice(0, 5),
    },
  };
}

export function formatLinkedInContextForAi(
  summary: LinkedInContextSummary,
): string {
  return `
## Activity context (${LINKEDIN_TIME_RANGE_LABEL(summary.timeRange)})

### Highlights
${summary.highlights.map((line) => (line.startsWith("  ·") ? line : `- ${line}`)).join("\n")}

### Stats
- Recent activity items: ${summary.stats.recentActivityCount}
- Open follow-ups: ${summary.stats.openFollowUps} (${summary.stats.criticalFollowUps} critical/high)
- Team utilization: ${summary.stats.teamUtilization ?? "n/a"}%
- Release: ${summary.stats.releaseHeadline ?? "none tracked"}
`.trim();
}

function LINKEDIN_TIME_RANGE_LABEL(range: LinkedInTimeRange): string {
  switch (range) {
    case "week":
      return "last 7 days";
    case "month":
      return "last 30 days";
    case "quarter":
      return "last 90 days";
  }
}
