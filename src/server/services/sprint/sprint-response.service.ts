import type { GitLabIssue, GitLabNote } from "@/domain/types/gitlab";
import type {
  SprintResponseByStatus,
  SprintResponseDeveloperNudge,
  SprintResponseIssue,
  SprintResponseMilestoneOption,
  SprintResponseSummary,
} from "@/domain/types/sprint-response";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";

const NOTE_FETCH_CONCURRENCY = 6;
const STATUS_PREFIX = "Status::";
const TYPE_PREFIX = "Type::";

const STATUS_PRIORITY: Record<string, number> = {
  Doing: 0,
  "Input-Required": 1,
  ToDo: 2,
  "Ready-For-QA": 3,
  "Ready-for-Deployment": 4,
  "QA-Doing": 5,
  "Ready-For-DeliveryQA": 6,
  Done: 9,
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

function labelValue(labels: string[], prefix: string): string | null {
  const match = labels.find((label) => label.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function toMilestoneOption(milestone: {
  id: number;
  title: string;
  state: string;
  start_date?: string | null;
  due_date?: string | null;
}): SprintResponseMilestoneOption {
  return {
    id: milestone.id,
    title: milestone.title,
    state: milestone.state,
    startDate: milestone.start_date ?? null,
    dueDate: milestone.due_date ?? null,
  };
}

function pickDefaultMilestone(
  milestones: SprintResponseMilestoneOption[],
  preferredTitle?: string,
): SprintResponseMilestoneOption | null {
  if (milestones.length === 0) return null;

  if (preferredTitle) {
    const exact = milestones.find((m) => m.title === preferredTitle);
    if (exact) return exact;
  }

  const today = new Date().toISOString().slice(0, 10);
  const active = milestones.filter((m) => m.state === "active");

  const inWindow = active.find((m) => {
    if (!m.startDate || !m.dueDate) return false;
    return m.startDate <= today && today <= m.dueDate;
  });
  if (inWindow) return inWindow;

  const upcoming = active
    .filter((m) => m.dueDate && m.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  if (upcoming[0]) return upcoming[0];

  return active[0] ?? milestones[0] ?? null;
}

function analyzeIssueNotes(
  issue: GitLabIssue,
  notes: GitLabNote[],
): SprintResponseIssue {
  const authorUsername = issue.author?.username ?? null;
  const assignees = (issue.assignees ?? []).map((a) => ({
    username: a.username,
    name: a.name,
  }));
  const assigneeUsernames = new Set(assignees.map((a) => a.username));

  const humanNotes = notes.filter((note) => !note.system);
  const developerNotes = humanNotes.filter((note) => {
    const username = note.author?.username;
    if (!username) return false;
    if (assigneeUsernames.has(username)) return true;
    return Boolean(authorUsername) && username !== authorUsername;
  });
  const assigneeNotes = humanNotes.filter((note) =>
    assigneeUsernames.has(note.author?.username),
  );
  const lastDeveloper = developerNotes[developerNotes.length - 1] ?? null;

  return {
    id: issue.id,
    iid: issue.iid,
    projectId: issue.project_id,
    title: issue.title,
    state: issue.state,
    webUrl: issue.web_url,
    authorUsername,
    assignees,
    labels: issue.labels ?? [],
    statusLabel: labelValue(issue.labels ?? [], STATUS_PREFIX),
    typeLabel: labelValue(issue.labels ?? [], TYPE_PREFIX),
    humanNoteCount: humanNotes.length,
    developerNoteCount: developerNotes.length,
    assigneeNoteCount: assigneeNotes.length,
    hasDeveloperResponse: developerNotes.length > 0,
    hasAssigneeResponse: assigneeNotes.length > 0,
    lastDeveloperUsername: lastDeveloper?.author?.username ?? null,
    lastDeveloperAt: lastDeveloper?.created_at ?? null,
  };
}

function statusSortKey(status: string | null): number {
  if (!status) return 7;
  return STATUS_PRIORITY[status] ?? 8;
}

function buildNudgeMessage(
  username: string,
  issues: SprintResponseIssue[],
): string {
  const lines = issues
    .slice()
    .sort((a, b) => a.iid - b.iid)
    .map((issue) => {
      const status = issue.statusLabel ?? "none";
      return `  - #${issue.iid} ${issue.title} [${status}]`;
    });

  return [
    `Hi @${username} — quick nudge on sprint issues that still have no developer comment/update:`,
    ...lines,
    "Could you add a short status update (blocker / ETA / next step) on each? Thanks!",
  ].join("\n");
}

function buildDeveloperNudges(
  issues: SprintResponseIssue[],
): {
  toNudge: SprintResponseDeveloperNudge[];
  fullyResponded: Array<{
    username: string;
    name: string;
    assignedCount: number;
  }>;
} {
  const byUsername = new Map<
    string,
    {
      name: string;
      assigned: SprintResponseIssue[];
      unanswered: SprintResponseIssue[];
    }
  >();

  for (const issue of issues) {
    for (const assignee of issue.assignees) {
      const entry = byUsername.get(assignee.username) ?? {
        name: assignee.name,
        assigned: [],
        unanswered: [],
      };
      entry.assigned.push(issue);
      if (!issue.hasDeveloperResponse) {
        entry.unanswered.push(issue);
      }
      byUsername.set(assignee.username, entry);
    }
  }

  const toNudge: SprintResponseDeveloperNudge[] = [];
  const fullyResponded: Array<{
    username: string;
    name: string;
    assignedCount: number;
  }> = [];

  for (const [username, entry] of byUsername) {
    const unansweredIssues = entry.unanswered
      .slice()
      .sort(
        (a, b) =>
          statusSortKey(a.statusLabel) - statusSortKey(b.statusLabel) ||
          a.iid - b.iid,
      );

    if (unansweredIssues.length === 0) {
      fullyResponded.push({
        username,
        name: entry.name,
        assignedCount: entry.assigned.length,
      });
      continue;
    }

    toNudge.push({
      username,
      name: entry.name,
      assignedCount: entry.assigned.length,
      respondedCount: entry.assigned.length - unansweredIssues.length,
      unansweredCount: unansweredIssues.length,
      unansweredIssues,
      nudgeMessage: buildNudgeMessage(username, unansweredIssues),
    });
  }

  toNudge.sort(
    (a, b) =>
      b.unansweredCount - a.unansweredCount ||
      b.assignedCount - a.assignedCount ||
      a.username.localeCompare(b.username),
  );
  fullyResponded.sort((a, b) => b.assignedCount - a.assignedCount);

  return { toNudge, fullyResponded };
}

function buildByStatus(issues: SprintResponseIssue[]): SprintResponseByStatus[] {
  const map = new Map<string, SprintResponseByStatus>();

  for (const issue of issues) {
    const status = issue.statusLabel ?? "(none)";
    const entry = map.get(status) ?? {
      status,
      total: 0,
      responded: 0,
      unanswered: 0,
    };
    entry.total += 1;
    if (issue.hasDeveloperResponse) entry.responded += 1;
    else entry.unanswered += 1;
    map.set(status, entry);
  }

  return Array.from(map.values()).sort(
    (a, b) => statusSortKey(a.status === "(none)" ? null : a.status) - statusSortKey(b.status === "(none)" ? null : b.status),
  );
}

function boardUrlForMilestone(
  baseUrl: string,
  groupPath: string | null,
  milestoneTitle: string,
): string | null {
  if (!groupPath) return null;
  const encoded = encodeURIComponent(milestoneTitle);
  const boardId = process.env.GITLAB_BOARD_ID?.trim();
  const boardSegment = boardId ? `boards/${boardId}` : "boards";
  return `${baseUrl.replace(/\/$/, "")}/groups/${groupPath}/-/${boardSegment}?milestone_title=${encoded}`;
}

export class SprintResponseService {
  private getProvider(): { provider: GitLabProvider; groupId: string; baseUrl: string } {
    const config = getGitLabConfig();
    if (!config) {
      throw new Error(
        "GitLab is not configured. Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID.",
      );
    }
    return {
      provider: createGitLabProvider(config),
      groupId: config.groupId,
      baseUrl: config.baseUrl,
    };
  }

  async listMilestones(): Promise<SprintResponseMilestoneOption[]> {
    const { provider, groupId } = this.getProvider();
    const groupIdNum = Number(groupId);
    const [active, closed] = await Promise.all([
      provider.listGroupMilestones(groupIdNum, "active"),
      provider.listGroupMilestones(groupIdNum, "closed"),
    ]);

    return [...active, ...closed]
      .filter((m) => /sprint/i.test(m.title))
      .map(toMilestoneOption)
      .sort((a, b) => {
        if (a.state !== b.state) return a.state === "active" ? -1 : 1;
        return (b.dueDate ?? "").localeCompare(a.dueDate ?? "");
      });
  }

  async getSummary(milestoneTitle?: string): Promise<SprintResponseSummary> {
    const { provider, groupId, baseUrl } = this.getProvider();
    const groupIdNum = Number(groupId);

    const milestones = await this.listMilestones();
    const milestone = pickDefaultMilestone(milestones, milestoneTitle);

    if (!milestone) {
      return {
        generatedAt: new Date().toISOString(),
        milestone: null,
        milestones,
        boardUrl: null,
        totalIssues: 0,
        openedCount: 0,
        closedCount: 0,
        withDeveloperResponse: 0,
        withoutDeveloperResponse: 0,
        withAssigneeResponse: 0,
        responseRate: 0,
        byStatus: [],
        issues: [],
        unansweredIssues: [],
        developersToNudge: [],
        fullyRespondedDevelopers: [],
        unassignedUnanswered: [],
      };
    }

    const [opened, closed, group] = await Promise.all([
      provider.listGroupIssues(groupId, {
        state: "opened",
        milestone: milestone.title,
      }),
      provider.listGroupIssues(groupId, {
        state: "closed",
        milestone: milestone.title,
      }),
      provider.getGroup(groupIdNum).catch(() => null),
    ]);

    const rawIssues = [...opened, ...closed];

    const analyzed = await mapWithConcurrency(
      rawIssues,
      NOTE_FETCH_CONCURRENCY,
      async (issue) => {
        const notes = await provider.listIssueNotes(issue.project_id, issue.iid);
        return analyzeIssueNotes(issue, notes);
      },
    );

    const unansweredIssues = analyzed
      .filter((issue) => !issue.hasDeveloperResponse)
      .sort(
        (a, b) =>
          statusSortKey(a.statusLabel) - statusSortKey(b.statusLabel) ||
          a.iid - b.iid,
      );

    const { toNudge, fullyResponded } = buildDeveloperNudges(analyzed);
    const withDeveloperResponse = analyzed.filter((i) => i.hasDeveloperResponse).length;
    const withAssigneeResponse = analyzed.filter((i) => i.hasAssigneeResponse).length;
    const openedCount = analyzed.filter((i) => i.state === "opened").length;
    const closedCount = analyzed.filter((i) => i.state === "closed").length;

    return {
      generatedAt: new Date().toISOString(),
      milestone,
      milestones,
      boardUrl: boardUrlForMilestone(
        baseUrl,
        group?.full_path ?? null,
        milestone.title,
      ),
      totalIssues: analyzed.length,
      openedCount,
      closedCount,
      withDeveloperResponse,
      withoutDeveloperResponse: unansweredIssues.length,
      withAssigneeResponse,
      responseRate:
        analyzed.length === 0
          ? 0
          : Math.round((withDeveloperResponse / analyzed.length) * 100),
      byStatus: buildByStatus(analyzed),
      issues: analyzed,
      unansweredIssues,
      developersToNudge: toNudge,
      fullyRespondedDevelopers: fullyResponded,
      unassignedUnanswered: unansweredIssues.filter(
        (issue) => issue.assignees.length === 0,
      ),
    };
  }
}

export const sprintResponseService = new SprintResponseService();
