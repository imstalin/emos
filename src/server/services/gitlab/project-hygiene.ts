import type { Priority, WorkItemState } from "@prisma/client";

import {
  ADMIN_GITLAB_PROJECT_ID,
  type HygieneGap,
  type HygieneWorkItem,
  type ProjectHygieneReport,
  type ProjectHygieneSummary,
} from "@/domain/types/project-hygiene";
import { checkDatabaseConnection, db } from "@/lib/db";
import { getGitLabConfig } from "@/lib/gitlab-config";

const HOURS_PER_POINT = 4;

const OPEN_STATES: WorkItemState[] = [
  "OPEN",
  "IN_PROGRESS",
  "IN_REVIEW",
  "QA",
  "BLOCKED",
];

function hasScopedLabel(labels: string[], prefix: string): boolean {
  const normalized = prefix.toLowerCase();
  return labels.some((label) => label.toLowerCase().startsWith(normalized));
}

function hasPriorityLabel(labels: string[]): boolean {
  return labels.some((label) => {
    const value = label.toLowerCase();
    return (
      value.startsWith("priority::") ||
      value.startsWith("productionpriority::") ||
      value === "critical" ||
      value === "high" ||
      value === "low" ||
      value === "blocker" ||
      value.startsWith("p1") ||
      value.startsWith("p2")
    );
  });
}

function detectGaps(item: {
  type: string;
  priority: Priority;
  storyPoints: number | null;
  assigneeId: string | null;
  milestoneTitle: string | null;
  labels: string[];
  dueDate: Date | null;
}): HygieneGap[] {
  const gaps: HygieneGap[] = [];

  if (item.type === "ISSUE" && item.storyPoints == null) {
    gaps.push("missing_weight");
  }
  if (!item.assigneeId) {
    gaps.push("missing_assignee");
  }
  if (!hasScopedLabel(item.labels, "type::")) {
    gaps.push("missing_type_label");
  }
  if (!hasScopedLabel(item.labels, "feature::")) {
    gaps.push("missing_feature_label");
  }
  if (!hasPriorityLabel(item.labels)) {
    gaps.push("missing_priority_label");
  }
  if (
    (item.priority === "HIGH" || item.priority === "CRITICAL") &&
    !item.dueDate
  ) {
    gaps.push("missing_due_date");
  }
  if (!item.milestoneTitle?.trim()) {
    gaps.push("missing_milestone");
  }

  return gaps;
}

export function detectWorkItemGaps(item: {
  type: string;
  priority: Priority;
  storyPoints: number | null;
  assigneeId: string | null;
  milestoneTitle: string | null;
  labels: string[];
  dueDate: Date | null;
}): HygieneGap[] {
  return detectGaps(item);
}

function buildSummary(items: HygieneWorkItem[]): ProjectHygieneSummary {
  const byGap: ProjectHygieneSummary["byGap"] = {
    missing_weight: 0,
    missing_assignee: 0,
    missing_type_label: 0,
    missing_feature_label: 0,
    missing_priority_label: 0,
    missing_due_date: 0,
    missing_milestone: 0,
  };

  let fullyCompliant = 0;
  let issuesOpen = 0;
  let mergeRequestsOpen = 0;
  let estimatedHoursGap = 0;

  for (const item of items) {
    if (item.type === "ISSUE") issuesOpen += 1;
    if (item.type === "MERGE_REQUEST") mergeRequestsOpen += 1;

    if (item.gaps.length === 0) {
      fullyCompliant += 1;
      continue;
    }

    for (const gap of item.gaps) {
      byGap[gap] += 1;
    }

    if (item.gaps.includes("missing_weight")) {
      estimatedHoursGap += HOURS_PER_POINT * 2;
    }
  }

  return {
    totalOpen: items.length,
    issuesOpen,
    mergeRequestsOpen,
    fullyCompliant,
    byGap,
    missingWeight: byGap.missing_weight,
    missingAssignee: byGap.missing_assignee,
    missingLabels:
      byGap.missing_type_label +
      byGap.missing_feature_label +
      byGap.missing_priority_label,
    estimatedHoursGap,
  };
}

export async function buildProjectHygieneReport(
  gitlabProjectId = ADMIN_GITLAB_PROJECT_ID,
): Promise<ProjectHygieneReport> {
  const connected = await checkDatabaseConnection();
  const config = getGitLabConfig();

  if (!connected) {
    return emptyReport(gitlabProjectId, `Project ${gitlabProjectId}`);
  }

  const project = await db.gitLabProject.findFirst({
    where: { gitlabId: gitlabProjectId },
    select: { id: true, name: true, gitlabPath: true },
  });

  if (!project) {
    return emptyReport(
      gitlabProjectId,
      `Project ${gitlabProjectId}`,
      config?.baseUrl
        ? `${config.baseUrl}/projects/${gitlabProjectId}`
        : null,
    );
  }

  const rows = await db.workItem.findMany({
    where: {
      projectId: project.id,
      state: { in: OPEN_STATES },
    },
    include: {
      assignee: { select: { name: true } },
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
  });

  const items: HygieneWorkItem[] = rows.map((row) => {
    const gaps = detectGaps(row);
    return {
      id: row.id,
      gitlabIid: row.gitlabIid,
      title: row.title,
      type: row.type,
      state: row.state,
      priority: row.priority,
      storyPoints: row.storyPoints,
      milestoneTitle: row.milestoneTitle,
      assigneeName: row.assignee?.name ?? null,
      labels: row.labels,
      dueDate: row.dueDate?.toISOString() ?? null,
      webUrl: row.webUrl,
      gaps,
    };
  });

  const withGaps = items.filter((item) => item.gaps.length > 0);

  return {
    gitlabProjectId,
    projectName: project.name,
    projectPath: project.gitlabPath,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(items),
    items: withGaps,
  };
}

function emptyReport(
  gitlabProjectId: number,
  projectName: string,
  projectPath: string | null = null,
): ProjectHygieneReport {
  return {
    gitlabProjectId,
    projectName,
    projectPath,
    generatedAt: new Date().toISOString(),
    summary: {
      totalOpen: 0,
      issuesOpen: 0,
      mergeRequestsOpen: 0,
      fullyCompliant: 0,
      byGap: {
        missing_weight: 0,
        missing_assignee: 0,
        missing_type_label: 0,
        missing_feature_label: 0,
        missing_priority_label: 0,
        missing_due_date: 0,
        missing_milestone: 0,
      },
      missingWeight: 0,
      missingAssignee: 0,
      missingLabels: 0,
      estimatedHoursGap: 0,
    },
    items: [],
  };
}
