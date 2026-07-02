import type { RoadmapItem } from "@/domain/types/roadmap";

export interface RoadmapGitLabIssuePreview {
  projectId: number;
  projectName: string;
  title: string;
  description: string;
  labels: string[];
  weight: number | null;
  milestoneTitle: string | null;
  assigneeName: string | null;
  assigneeGitLabUsername: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  parentEpicIid: number | null;
  parentEpicTitle: string | null;
  parentEpicUrl: string | null;
}

export interface RoadmapGitLabCreateResult {
  item: RoadmapItem;
  issue: {
    iid: number;
    webUrl: string;
    title: string;
  };
}

export interface RoadmapAiDescriptionRequest {
  mode: "generate" | "rewrite";
  title: string;
  description?: string;
  project: string;
  category: string;
  priority: string;
  quarter: string;
  assignee?: string;
}

export interface RoadmapAiDescriptionResponse {
  description: string;
}
