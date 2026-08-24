import type { ProgressMovement } from "@prisma/client";

import type { ProgressIndicator } from "@/domain/types/manager-progress";
import {
  isMeaningfulStageTransition,
} from "@/domain/manager-progress/lifecycle-engine";

export function toProgressIndicator(movement: ProgressMovement): ProgressIndicator {
  switch (movement) {
    case "MEANINGFUL_PROGRESS":
      return "meaningful_progress";
    case "BLOCKED":
      return "blocked";
    case "SLIPPING":
      return "slipping";
    case "COMPLETED":
      return "completed";
    default:
      return "active_no_movement";
  }
}

export function progressIndicatorLabel(indicator: ProgressIndicator): string {
  switch (indicator) {
    case "meaningful_progress":
      return "↑ Meaningful progress";
    case "active_no_movement":
      return "→ Active / no stage movement";
    case "blocked":
      return "⚠ Blocked / attention needed";
    case "slipping":
      return "↓ Slipping / delayed";
    case "completed":
      return "✓ Completed";
  }
}

export function determineMovement(
  previousStage: string,
  currentStage: string,
  eventType: string,
  hasBlocker: boolean,
): ProgressMovement {
  if (currentStage === "completed") return "COMPLETED";
  if (hasBlocker) return "BLOCKED";
  if (isMeaningfulStageTransition(previousStage, currentStage, eventType)) {
    return "MEANINGFUL_PROGRESS";
  }
  return "ACTIVE_NO_MOVEMENT";
}

export function statusFromIndicator(
  indicator: ProgressIndicator,
  hasBlocker: boolean,
): "on_track" | "attention" | "blocked" | "no_movement" | "completed" {
  if (indicator === "completed") return "completed";
  if (hasBlocker || indicator === "blocked") return "blocked";
  if (indicator === "slipping") return "attention";
  if (indicator === "meaningful_progress") return "on_track";
  if (indicator === "active_no_movement") return "no_movement";
  return "on_track";
}

export function progressIndicatorEmoji(
  indicator: ProgressIndicator,
): string {
  switch (indicator) {
    case "meaningful_progress":
      return "↑";
    case "active_no_movement":
      return "→";
    case "blocked":
      return "⚠";
    case "slipping":
      return "↓";
    case "completed":
      return "✓";
  }
}
