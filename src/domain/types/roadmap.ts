export type RoadmapPriority = "Critical" | "High" | "Medium" | "Low";

export type RoadmapInclude = "Yes" | "No" | "Pending";

export type RoadmapHours = number | "TBD";

export type RoadmapSortField = "priority" | "quarter" | "hours";

export type RoadmapSortDirection = "asc" | "desc";

export interface RoadmapGitLabLink {
  projectId: number;
  issueIid: number;
  issueUrl: string;
  issueId: number;
  createdAt: string;
}

export interface RoadmapItem {
  id: string;
  priority: RoadmapPriority;
  include: RoadmapInclude;
  project: string;
  category: string;
  quarter: string;
  timeline: string;
  assignee: string;
  hours: RoadmapHours;
  core: boolean;
  mobile: boolean;
  data: boolean;
  title: string;
  description: string;
  gitlab?: RoadmapGitLabLink;
  hoursSpent?: number;
}

export interface RoadmapFiltersState {
  search: string;
  project: string;
  quarter: string;
  priority: string;
  category: string;
  assignee: string;
  include: string;
}

export interface RoadmapSortState {
  field: RoadmapSortField;
  direction: RoadmapSortDirection;
}

export interface RoadmapSummary {
  totalItems: number;
  criticalItems: number;
  highPriorityItems: number;
  totalEstimatedHours: number;
  totalHoursSpent: number;
  linkedGitLabIssues: number;
  tbdHoursCount: number;
  byQuarter: Array<{ quarter: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
}

export interface RoadmapData {
  items: RoadmapItem[];
  summary: RoadmapSummary;
  generatedAt: string;
  sourceSheet: string;
  slug: string;
}

export const ROADMAP_SHEET_FY27_V1 = "FY27 V1";

export const DEFAULT_ROADMAP_SLUG = "fy27-v1";

export const ROADMAP_PRIORITIES: RoadmapPriority[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

export const ROADMAP_INCLUDE_OPTIONS: RoadmapInclude[] = ["Yes", "No", "Pending"];

export const ROADMAP_PROJECTS = [
  "CS 1.0",
  "CS 2.0",
  "CS 2.0 Core",
  "CS 2.0 Achievo",
  "CS 2.0 Data",
] as const;

export const ROADMAP_CATEGORIES = [
  "Maintenance",
  "Tech Maintenance",
  "Tech Enhancements",
  "Enhancement",
  "Feature",
  "New Feature",
] as const;

export const DEFAULT_ROADMAP_FILTERS: RoadmapFiltersState = {
  search: "",
  project: "ALL",
  quarter: "ALL",
  priority: "ALL",
  category: "ALL",
  assignee: "ALL",
  include: "ALL",
};

export const DEFAULT_ROADMAP_SORT: RoadmapSortState = {
  field: "priority",
  direction: "asc",
};
