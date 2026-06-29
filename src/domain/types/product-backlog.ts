import type { Priority } from "@prisma/client";

import type { WorkItemSummary } from "@/domain/types/dashboard";

export type ProductBacklogTab = "tasks" | "defects";

export interface ProductBacklogItem extends WorkItemSummary {
  gitlabIid: number | null;
  storyPoints: number | null;
  typeLabel: string | null;
  lastActivityAt: string | null;
}

export interface ProductBacklogSummary {
  tasks: number;
  defects: number;
  total: number;
  critical: number;
  high: number;
  unassigned: number;
  byProject: Array<{ projectName: string; count: number }>;
}

export interface ProductBacklogData {
  generatedAt: string;
  summary: ProductBacklogSummary;
  tasks: ProductBacklogItem[];
  defects: ProductBacklogItem[];
}
