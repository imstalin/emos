import type { MemberRole } from "@prisma/client";

import { wipLimitForPlanningRole } from "@/domain/sprint/planning-capacity";

export type WorkloadBasis = "story_points" | "active_items";

const POINTS_PER_ITEM = 5;
const POINT_COVERAGE_THRESHOLD = 0.3;

export interface WorkloadInput {
  storyPoints: number | null;
}

export interface MemberWorkload {
  activeItems: number;
  assignedPoints: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  loadBasis: WorkloadBasis;
  wipLimit: number;
}

export interface TeamWorkloadTotals {
  totalCapacity: number;
  totalWipLimit: number;
  allocatedPoints: number;
  allocatedItems: number;
  utilizationPercent: number;
  membersOverCapacity: number;
  loadBasis: WorkloadBasis;
}

function wipLimitForCapacity(capacity: number): number {
  return Math.max(1, Math.round(capacity / POINTS_PER_ITEM));
}

export function shouldUseStoryPoints(
  items: WorkloadInput[],
  assignedPoints: number,
): boolean {
  if (assignedPoints <= 0) return false;

  const itemsWithPoints = items.filter(
    (item) => item.storyPoints != null && item.storyPoints > 0,
  ).length;

  return itemsWithPoints >= Math.max(1, Math.ceil(items.length * POINT_COVERAGE_THRESHOLD));
}

export function computeMemberWorkload(
  items: WorkloadInput[],
  capacity: number,
  role?: MemberRole,
): MemberWorkload {
  const activeItems = items.length;
  const assignedPoints = items.reduce(
    (sum, item) => sum + (item.storyPoints ?? 0),
    0,
  );
  const loadBasis: WorkloadBasis = shouldUseStoryPoints(items, assignedPoints)
    ? "story_points"
    : "active_items";
  const wipLimit = role
    ? wipLimitForPlanningRole(capacity, role)
    : wipLimitForCapacity(capacity);

  const utilizationPercent =
    loadBasis === "story_points"
      ? capacity > 0
        ? Math.min(100, Math.round((assignedPoints / capacity) * 100))
        : 0
      : Math.min(100, Math.round((activeItems / wipLimit) * 100));

  const isOverloaded =
    loadBasis === "story_points"
      ? assignedPoints > capacity * 0.5
      : activeItems > wipLimit;

  return {
    activeItems,
    assignedPoints,
    utilizationPercent,
    isOverloaded,
    loadBasis,
    wipLimit,
  };
}

export function computeTeamWorkloadTotals(
  members: Array<{
    capacity: number;
    activeItems: number;
    assignedPoints: number;
    loadBasis: WorkloadBasis;
    isOverloaded: boolean;
  }>,
): TeamWorkloadTotals {
  const totalCapacity = members.reduce((sum, member) => sum + member.capacity, 0);
  const totalWipLimit = members.reduce(
    (sum, member) => sum + wipLimitForCapacity(member.capacity),
    0,
  );
  const allocatedPoints = members.reduce(
    (sum, member) => sum + member.assignedPoints,
    0,
  );
  const allocatedItems = members.reduce(
    (sum, member) => sum + member.activeItems,
    0,
  );
  const usesStoryPoints = members.some(
    (member) => member.loadBasis === "story_points" && member.assignedPoints > 0,
  );
  const loadBasis: WorkloadBasis = usesStoryPoints
    ? "story_points"
    : "active_items";

  const utilizationPercent =
    loadBasis === "story_points"
      ? totalCapacity > 0
        ? Math.round((allocatedPoints / totalCapacity) * 100)
        : 0
      : totalWipLimit > 0
        ? Math.round((allocatedItems / totalWipLimit) * 100)
        : 0;

  return {
    totalCapacity,
    totalWipLimit,
    allocatedPoints,
    allocatedItems,
    utilizationPercent,
    membersOverCapacity: members.filter((member) => member.isOverloaded).length,
    loadBasis,
  };
}

export function sprintProgress(
  items: WorkloadInput[],
  doneItems: WorkloadInput[],
): {
  totalPoints: number;
  completedPoints: number;
  totalItems: number;
  completedCount: number;
  loadBasis: WorkloadBasis;
} {
  const openPoints = items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
  const donePoints = doneItems.reduce(
    (sum, item) => sum + (item.storyPoints ?? 0),
    0,
  );
  const totalPoints = openPoints + donePoints;
  const loadBasis: WorkloadBasis = shouldUseStoryPoints(
    [...items, ...doneItems],
    totalPoints,
  )
    ? "story_points"
    : "active_items";

  return {
    totalPoints: loadBasis === "story_points" ? totalPoints : items.length + doneItems.length,
    completedPoints: loadBasis === "story_points" ? donePoints : doneItems.length,
    totalItems: items.length + doneItems.length,
    completedCount: doneItems.length,
    loadBasis,
  };
}
