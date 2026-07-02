export const ADMIN_GITLAB_PROJECT_ID = 6100;

export type HygieneGap =
  | "missing_weight"
  | "missing_assignee"
  | "missing_type_label"
  | "missing_feature_label"
  | "missing_priority_label"
  | "missing_due_date"
  | "missing_milestone";

export interface HygieneWorkItem {
  id: string;
  gitlabIid: number | null;
  title: string;
  type: string;
  state: string;
  priority: string;
  storyPoints: number | null;
  milestoneTitle: string | null;
  assigneeName: string | null;
  labels: string[];
  dueDate: string | null;
  webUrl: string | null;
  gaps: HygieneGap[];
}

export interface ProjectHygieneSummary {
  totalOpen: number;
  issuesOpen: number;
  mergeRequestsOpen: number;
  fullyCompliant: number;
  byGap: Record<HygieneGap, number>;
  missingWeight: number;
  missingAssignee: number;
  missingLabels: number;
  estimatedHoursGap: number;
}

export interface ProjectHygieneReport {
  gitlabProjectId: number;
  projectName: string;
  projectPath: string | null;
  generatedAt: string;
  summary: ProjectHygieneSummary;
  items: HygieneWorkItem[];
}
