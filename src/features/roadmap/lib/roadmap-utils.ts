import {
  DEFAULT_ROADMAP_FILTERS,
  ROADMAP_PRIORITIES,
  type RoadmapFiltersState,
  type RoadmapHours,
  type RoadmapInclude,
  type RoadmapItem,
  type RoadmapPriority,
  type RoadmapSortState,
  type RoadmapSummary,
} from "@/domain/types/roadmap";

const PRIORITY_RANK: Record<RoadmapPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export function normalizePriority(value: unknown): RoadmapPriority {
  const raw = String(value ?? "Medium").trim().toLowerCase();
  if (raw.startsWith("crit")) return "Critical";
  if (raw.startsWith("hi")) return "High";
  if (raw.startsWith("med")) return "Medium";
  if (raw.startsWith("lo")) return "Low";
  return "Medium";
}

export function normalizeInclude(value: unknown): RoadmapInclude {
  const raw = String(value ?? "Pending").trim().toLowerCase();
  if (raw === "yes" || raw === "y") return "Yes";
  if (raw === "no" || raw === "n") return "No";
  return "Pending";
}

export function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return false;
  const raw = String(value).trim().toLowerCase();
  return raw === "y" || raw === "yes" || raw === "true" || raw === "1" || raw === "x";
}

export function parseRoadmapHours(value: unknown): RoadmapHours {
  if (value === null || value === undefined || value === "") return "TBD";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw || raw.toUpperCase() === "TBD") return "TBD";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : "TBD";
}

export function formatRoadmapHours(hours: RoadmapHours): string {
  return hours === "TBD" ? "TBD" : String(hours);
}

export function hoursToSortValue(hours: RoadmapHours): number {
  return hours === "TBD" ? Number.MAX_SAFE_INTEGER : hours;
}

export function getPriorityBadgeColor(
  priority: RoadmapPriority,
): "red" | "orange" | "yellow" | "gray" {
  switch (priority) {
    case "Critical":
      return "red";
    case "High":
      return "orange";
    case "Medium":
      return "yellow";
    case "Low":
      return "gray";
  }
}

export function getIncludeBadgeColor(
  include: RoadmapInclude,
): "green" | "red" | "yellow" {
  switch (include) {
    case "Yes":
      return "green";
    case "No":
      return "red";
    case "Pending":
      return "yellow";
  }
}

export function filterRoadmapItems(
  items: RoadmapItem[],
  filters: RoadmapFiltersState = DEFAULT_ROADMAP_FILTERS,
): RoadmapItem[] {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.project !== "ALL" && item.project !== filters.project) return false;
    if (filters.quarter !== "ALL" && item.quarter !== filters.quarter) return false;
    if (filters.priority !== "ALL" && item.priority !== filters.priority) return false;
    if (filters.category !== "ALL" && item.category !== filters.category) return false;
    if (filters.assignee !== "ALL" && item.assignee !== filters.assignee) return false;
    if (filters.include !== "ALL" && item.include !== filters.include) return false;

    if (!query) return true;

    return (
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  });
}

export function sortRoadmapItems(
  items: RoadmapItem[],
  sort: RoadmapSortState,
): RoadmapItem[] {
  const sorted = [...items];
  const direction = sort.direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case "priority":
        return (
          (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * direction
        );
      case "quarter":
        return a.quarter.localeCompare(b.quarter) * direction;
      case "hours":
        return (
          (hoursToSortValue(a.hours) - hoursToSortValue(b.hours)) * direction
        );
      default:
        return 0;
    }
  });

  return sorted;
}

export function buildRoadmapSummary(items: RoadmapItem[]): RoadmapSummary {
  const byQuarter = new Map<string, number>();
  const byCategory = new Map<string, number>();

  let criticalItems = 0;
  let highPriorityItems = 0;
  let totalEstimatedHours = 0;
  let totalHoursSpent = 0;
  let linkedGitLabIssues = 0;
  let tbdHoursCount = 0;

  for (const item of items) {
    if (item.priority === "Critical") criticalItems += 1;
    if (item.priority === "High") highPriorityItems += 1;

    if (item.hours === "TBD") {
      tbdHoursCount += 1;
    } else {
      totalEstimatedHours += item.hours;
    }

    if (item.gitlab) linkedGitLabIssues += 1;
    totalHoursSpent += item.hoursSpent ?? 0;

    byQuarter.set(item.quarter, (byQuarter.get(item.quarter) ?? 0) + 1);
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }

  const toSortedCountEntries = (entries: Map<string, number>) =>
    [...entries.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));

  return {
    totalItems: items.length,
    criticalItems,
    highPriorityItems,
    totalEstimatedHours,
    totalHoursSpent,
    linkedGitLabIssues,
    tbdHoursCount,
    byQuarter: toSortedCountEntries(byQuarter).map(({ key, count }) => ({
      quarter: key,
      count,
    })),
    byCategory: toSortedCountEntries(byCategory).map(({ key, count }) => ({
      category: key,
      count,
    })),
  };
}

export function collectFilterOptions(items: RoadmapItem[]) {
  const unique = (values: string[]) =>
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return {
    projects: unique(items.map((item) => item.project)),
    quarters: unique(items.map((item) => item.quarter)),
    categories: unique(items.map((item) => item.category)),
    assignees: unique(items.map((item) => item.assignee)),
    priorities: ROADMAP_PRIORITIES,
  };
}

export function createEmptyRoadmapItem(): Omit<RoadmapItem, "id"> {
  return {
    priority: "Medium",
    include: "Pending",
    project: "CS 2.0 Core",
    category: "Enhancement",
    quarter: "Q1",
    timeline: "Q1 FY27",
    assignee: "",
    hours: "TBD",
    core: false,
    mobile: false,
    data: false,
    title: "",
    description: "",
  };
}
