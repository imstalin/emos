import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";
import { governanceService } from "@/server/services/governance/governance.service";
import { releasesService } from "@/server/services/releases/releases.service";
import { teamDashboardService } from "@/server/services/team/team-dashboard.service";
import {
  followUpTicketService,
  formatTicketContextForAssistant,
} from "@/server/services/assistant/follow-up-ticket.service";

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export async function buildAssistantContext(): Promise<string> {
  const [followUps, team, releases, governance] = await Promise.all([
    followUpsService.getDashboard(),
    teamDashboardService.getDashboard(),
    releasesService.getDashboard(),
    governanceService.getReport(),
  ]);

  const followUpLines = followUps.items
    .slice(0, 15)
    .map(
      (item) =>
        `- [${item.priority}] ${item.category}: ${item.title}${item.assigneeName ? ` (${item.assigneeName})` : ""} — ${item.reason}. Action: ${item.suggestedAction}${item.webUrl ? ` | ${item.webUrl}` : ""}`,
    )
    .join("\n");

  const developerLines = team.members
    .filter((member) => member.role === "DEVELOPER" || member.activeItems > 0)
    .slice(0, 12)
    .map((member) => {
      const idleDays = daysSince(member.lastActivityAt);
      const topItems = member.assignedItems
        .slice(0, 6)
        .map(
          (item) =>
            `    • [${item.state}/${item.priority}] ${item.title}${item.milestoneTitle ? ` (${item.milestoneTitle})` : ""}${item.webUrl ? ` ${item.webUrl}` : ""}`,
        )
        .join("\n");
      return `- ${member.name} (${member.role}): active ${member.activeItems}, blocked ${member.blockedCount}, review ${member.inReviewCount}, QA ${member.inQaCount}, MRs ${member.mergeRequestCount}, load ${member.utilizationPercent}%${member.isOverloaded ? " OVERLOADED" : ""}, health ${member.health}, last activity ${idleDays == null ? "unknown" : `${idleDays}d ago`}
${topItems || "    • No assigned open items"}`;
    })
    .join("\n");

  const releaseLines = [
    ...releases.monthlyReleases.flatMap((group) =>
      group.epics.slice(0, 3).map(
        (epic) =>
          `- ${epic.title}: ${epic.spentHours}/${epic.plannedHours}h, ${epic.progressPercent}% complete, ${epic.openItems} open, health ${epic.health}`,
      ),
    ),
    ...releases.releases.slice(0, 3).map(
      (release) =>
        `- v${release.version} ${release.name ?? ""} (${release.projectName}): ${release.progressPercent}% complete, ${release.openItems} open`,
    ),
  ].join("\n");

  const sprintSection = team.sprint
    ? `Active sprint: ${team.sprint.name}
Goal: ${team.sprint.goal ?? "—"}
Window: ${team.sprint.startDate} → ${team.sprint.endDate} (${team.sprint.daysRemaining} days left)
Progress: ${team.sprint.completedPoints}/${team.sprint.totalPoints} points
QA paired: ${team.sprint.qaPairedCount}, QA unassigned: ${team.sprint.qaUnassignedCount}
In review: ${team.sprint.inReviewCount}, in QA: ${team.sprint.inQaCount}`
    : "No active sprint configured.";

  const qaQueueLines = team.qaQueue
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.title} (${item.assigneeName ?? "unassigned"})${item.webUrl ? ` ${item.webUrl}` : ""}`,
    )
    .join("\n");

  const atRiskItems = team.sprintWorkItems
    .filter(
      (item) =>
        item.health === "AT_RISK" ||
        item.health === "CRITICAL" ||
        item.state === "BLOCKED",
    )
    .slice(0, 12)
    .map(
      (item) =>
        `- [${item.health}/${item.state}] ${item.title} — ${item.assigneeName ?? "unassigned"}${item.webUrl ? ` ${item.webUrl}` : ""}`,
    )
    .join("\n");

  return `
## Delivery snapshot (live from EMOS)

### Follow-ups (${followUps.total} total — ${followUps.byPriority.critical} critical, ${followUps.byPriority.high} high)
${followUpLines || "No follow-ups detected."}

### Team capacity
Sprint utilization: ${team.teamCapacity.utilizationPercent}%
Members over recommended load: ${team.teamCapacity.membersOverCapacity}
Allocated: ${team.teamCapacity.allocatedItems} items / ${team.teamCapacity.allocatedPoints} points

### Per-developer dossier
${developerLines || "No assigned work on roster."}

### Sprint
${sprintSection}

### Stories at risk / blocked
${atRiskItems || "No at-risk sprint items flagged."}

### QA queue
${qaQueueLines || "QA queue empty."}

### Releases
${releaseLines || "No active releases."}

### Governance
Score: ${governance.score}/100
Violations: ${governance.violationCount} (${governance.violationsBySeverity.error} errors, ${governance.violationsBySeverity.warning} warnings)
`.trim();
}

export async function buildFollowUpContext(
  followUpId: string,
): Promise<string | null> {
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
