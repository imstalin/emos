import type { WorkItemSummary } from "@/domain/types/dashboard";

const TYPE_LABEL_PATTERN = /^type::(.+)$/i;

export type ProductBacklogCategory = "task" | "defect";

export function getScopedTypeLabel(labels: string[]): string | null {
  for (const label of labels) {
    const match = label.match(TYPE_LABEL_PATTERN);
    if (match) return match[1].trim().toLowerCase();
  }
  return null;
}

export function isDefectTypeLabel(labels: string[]): boolean {
  const scopedType = getScopedTypeLabel(labels);
  if (scopedType) return scopedType === "defect";
  return labels.some((label) => label.trim().toLowerCase() === "defect");
}

export function isBacklogMilestone(milestoneTitle: string | null | undefined): boolean {
  return milestoneTitle?.trim().toLowerCase() === "backlog";
}

export function classifyProductBacklog(
  milestoneTitle: string | null | undefined,
  labels: string[],
): ProductBacklogCategory | null {
  if (!isBacklogMilestone(milestoneTitle)) return null;
  return isDefectTypeLabel(labels) ? "defect" : "task";
}

export function partitionProductBacklog<T extends Pick<WorkItemSummary, "milestoneTitle" | "labels">>(
  items: T[],
): { tasks: T[]; defects: T[] } {
  const tasks: T[] = [];
  const defects: T[] = [];

  for (const item of items) {
    const category = classifyProductBacklog(item.milestoneTitle, item.labels);
    if (category === "defect") defects.push(item);
    else if (category === "task") tasks.push(item);
  }

  return { tasks, defects };
}
