import type { WorkloadBasis } from "@/domain/workload/compute-workload";

export function formatWorkloadLoadLabel(
  loadBasis: WorkloadBasis,
  assignedPoints: number,
  activeItems: number,
  wipLimit: number,
): string {
  if (loadBasis === "story_points") {
    return `${assignedPoints} pts assigned`;
  }

  return `${activeItems} / ${wipLimit} active items`;
}

export function formatTeamCapacityLabel(
  loadBasis: WorkloadBasis,
  allocatedPoints: number,
  allocatedItems: number,
  totalCapacity: number,
  totalWipLimit: number,
): string {
  if (loadBasis === "story_points") {
    return `${allocatedPoints} / ${totalCapacity} story points`;
  }

  return `${allocatedItems} / ${totalWipLimit} active items`;
}

export function formatSprintProgressLabel(
  loadBasis: WorkloadBasis,
  completedPoints: number,
  totalPoints: number,
  completedItems: number,
  totalItems: number,
): string {
  if (loadBasis === "story_points") {
    return `${completedPoints} / ${totalPoints} points`;
  }

  return `${completedItems} / ${totalItems} items`;
}
