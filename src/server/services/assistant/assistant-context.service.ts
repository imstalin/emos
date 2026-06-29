import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";
import { governanceService } from "@/server/services/governance/governance.service";
import { releasesService } from "@/server/services/releases/releases.service";
import { teamDashboardService } from "@/server/services/team/team-dashboard.service";
import {
  followUpTicketService,
  formatTicketContextForAssistant,
} from "@/server/services/assistant/follow-up-ticket.service";

export async function buildAssistantContext(): Promise<string> {
  const [followUps, team, releases, governance] = await Promise.all([
    followUpsService.getDashboard(),
    teamDashboardService.getDashboard(),
    releasesService.getDashboard(),
    governanceService.getReport(),
  ]);

  const followUpLines = followUps.items
    .slice(0, 12)
    .map(
      (item) =>
        `- [${item.priority}] ${item.category}: ${item.title}${item.assigneeName ? ` (${item.assigneeName})` : ""}`,
    )
    .join("\n");

  const teamLines = team.members
    .filter((member) => member.activeItems > 0)
    .slice(0, 10)
    .map(
      (member) =>
        `- ${member.name} (${member.role}): ${member.activeItems} active, ${member.blockedCount} blocked, ${member.utilizationPercent}% load`,
    )
    .join("\n");

  const releaseLines = releases.releases
    .slice(0, 5)
    .map(
      (release) =>
        `- v${release.version} ${release.name ?? ""} (${release.projectName}): ${release.progressPercent}% complete, ${release.openItems} open, ${release.blockedItems} blocked, health ${release.health}`,
    )
    .join("\n");

  const sprintSection = team.activeSprint
    ? `Active sprint: ${team.activeSprint.name}
Goal: ${team.activeSprint.goal ?? "—"}
Progress: ${team.activeSprint.completedPoints}/${team.activeSprint.totalPoints} points, ${team.activeSprint.daysRemaining} days left`
    : "No active sprint configured.";

  return `
## Delivery snapshot (live from EMOS)

### Follow-ups (${followUps.total} total — ${followUps.byPriority.critical} critical, ${followUps.byPriority.high} high)
${followUpLines || "No follow-ups detected."}

### Team capacity
Sprint utilization: ${team.teamCapacity.utilizationPercent}%
Members over recommended load: ${team.teamCapacity.membersOverCapacity}
${teamLines || "No assigned work on roster."}

### Sprint
${sprintSection}

### Releases
${releaseLines || "No active releases."}

### Governance
Score: ${governance.score}/100
Violations: ${governance.violationCount} (${governance.violationsBySeverity.error} errors, ${governance.violationsBySeverity.warning} warnings)
`.trim();
}

export async function buildFollowUpContext(followUpId: string): Promise<string | null> {
  const item = await followUpsService.getItemById(followUpId);
  if (!item) return null;

  const ticket = await followUpTicketService.getTicketContext(followUpId);

  const sections = [
    `
The user wants help with this specific follow-up:
- Title: ${item.title}
- Category: ${item.category}
- Priority: ${item.priority}
- Reason: ${item.reason}
- Suggested action: ${item.suggestedAction}
- Assignee: ${item.assigneeName ?? "Unassigned"}
- Project: ${item.projectName ?? "—"}
- GitLab URL: ${item.webUrl ?? "—"}
`.trim(),
  ];

  if (ticket) {
    sections.push(formatTicketContextForAssistant(ticket));
  }

  return sections.join("\n\n");
}
