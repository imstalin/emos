import type { ReleaseStream } from "@prisma/client";

import type { RoadmapHours, RoadmapItem, RoadmapPriority } from "@/domain/types/roadmap";
import type { RoadmapGitLabIssuePreview } from "@/domain/types/roadmap-gitlab";
import { ADMIN_GITLAB_PROJECT_ID } from "@/domain/types/project-hygiene";
import type { GitLabUser } from "@/domain/types/gitlab";

const PROJECT_FEATURE_LABEL: Record<string, string> = {
  "CS 1.0": "Feature::Common",
  "CS 2.0": "Feature::Common",
  "CS 2.0 Core": "Feature::CommandEngine",
  "CS 2.0 Achievo": "Feature::Achievo",
  "CS 2.0 Data": "Feature::DataFlux",
};

function mapPriorityLabel(priority: RoadmapPriority): string {
  switch (priority) {
    case "Critical":
      return "priority::blocker";
    case "High":
      return "priority::high";
    case "Medium":
      return "priority::medium";
    case "Low":
      return "priority::low";
  }
}

function mapTypeLabel(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes("defect")) return "Type::Defect";
  if (normalized.includes("new feature")) return "Type::Story";
  if (normalized.includes("story")) return "Type::Story";
  return "Type::Task";
}

function mapChangeTypeLabel(category: string): string | null {
  const normalized = category.toLowerCase();
  if (normalized.includes("new feature")) return "Change Type::New Feature";
  if (normalized.includes("change request")) return "Change Type::Change Request";
  if (
    normalized.includes("enhancement") ||
    normalized.includes("maintenance") ||
    normalized.includes("feature")
  ) {
    return "Change Type::Enhancements";
  }
  return null;
}

export function hoursToGitLabWeight(hours: RoadmapHours): number | null {
  if (hours === "TBD") return null;
  return Math.max(1, Math.min(8, Math.round(hours / 4)));
}

export function buildGitLabLabels(item: Pick<
  RoadmapItem,
  "priority" | "project" | "category" | "core" | "mobile" | "data"
>): string[] {
  const labels = [
    mapTypeLabel(item.category),
    mapPriorityLabel(item.priority),
    PROJECT_FEATURE_LABEL[item.project] ?? "Feature::Common",
    "plan::fy27",
    "Type::Backlog",
  ];

  const changeType = mapChangeTypeLabel(item.category);
  if (changeType) labels.push(changeType);

  if (item.core) labels.push("Code::BackEnd");
  if (item.mobile) labels.push("Feature::Achievo");
  if (item.data) labels.push("Feature::DataFlux");

  return [...new Set(labels)];
}

export function buildGitLabIssueDescription(
  item: Pick<
    RoadmapItem,
    | "title"
    | "description"
    | "project"
    | "category"
    | "quarter"
    | "timeline"
    | "assignee"
    | "hours"
    | "include"
    | "core"
    | "mobile"
    | "data"
  >,
): string {
  const sections = [
    item.description.trim(),
    "",
    "---",
    "**FY27 Roadmap metadata**",
    `- Project: ${item.project}`,
    `- Category: ${item.category}`,
    `- Quarter: ${item.quarter}`,
    `- Timeline: ${item.timeline}`,
    `- Include: ${item.include}`,
    `- Assignee (plan): ${item.assignee || "Unassigned"}`,
    `- Estimated hours: ${item.hours === "TBD" ? "TBD" : `${item.hours}h`}`,
    `- Core / Mobile / Data: ${item.core ? "Y" : "N"} / ${item.mobile ? "Y" : "N"} / ${item.data ? "Y" : "N"}`,
    "",
    "_Created from EMOS Roadmap Maintenance_",
  ];

  return sections.filter((line, index, arr) => {
    if (line !== "") return true;
    return arr[index - 1] !== "";
  }).join("\n");
}

export function resolveGitLabAssignee(
  assignee: string,
  members: GitLabUser[],
): GitLabUser | null {
  const query = assignee.trim().toLowerCase();
  if (!query) return null;

  const exact = members.find(
    (member) =>
      member.username.toLowerCase() === query ||
      member.name.toLowerCase() === query,
  );
  if (exact) return exact;

  const initials = members.find((member) => {
    const parts = member.name.split(/\s+/).filter(Boolean);
    const short = parts.map((part) => part[0]?.toLowerCase() ?? "").join("");
    return short === query || member.name.toLowerCase().includes(query);
  });
  if (initials) return initials;

  return (
    members.find((member) => member.name.toLowerCase().includes(query)) ?? null
  );
}

export function resolveRoadmapReleaseStream(item: Pick<
  RoadmapItem,
  "mobile" | "project" | "data"
>): ReleaseStream {
  if (item.mobile || item.project === "CS 2.0 Achievo") {
    return "MOBILE";
  }
  if (item.project.toLowerCase().includes("observation")) {
    return "OBSERVATIONS";
  }
  return "PRODUCT";
}

export function buildGitLabIssuePreview(
  item: RoadmapItem,
  params: {
    projectName: string;
    milestoneTitle: string | null;
    assignee: GitLabUser | null;
    parentEpic?: {
      epicIid: number;
      title: string;
      webUrl: string | null;
    } | null;
  },
): RoadmapGitLabIssuePreview {
  const estimatedHours = item.hours === "TBD" ? null : item.hours;

  return {
    projectId: ADMIN_GITLAB_PROJECT_ID,
    projectName: params.projectName,
    title: item.title.trim(),
    description: buildGitLabIssueDescription(item),
    labels: buildGitLabLabels(item),
    weight: hoursToGitLabWeight(item.hours),
    milestoneTitle: params.milestoneTitle,
    assigneeName: params.assignee?.name ?? (item.assignee || null),
    assigneeGitLabUsername: params.assignee?.username ?? null,
    dueDate: null,
    estimatedHours,
    parentEpicIid: params.parentEpic?.epicIid ?? null,
    parentEpicTitle: params.parentEpic?.title ?? null,
    parentEpicUrl: params.parentEpic?.webUrl ?? null,
  };
}
