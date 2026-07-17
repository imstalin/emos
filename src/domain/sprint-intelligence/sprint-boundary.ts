import type {
  SprintBoundaries,
  SprintIntelligenceRuleConfig,
  SprintMilestoneInput,
} from "@/domain/types/sprint-intelligence";

import { endOfDayInTimeZone, startOfDayInTimeZone } from "./timezone";

export type SprintBoundaryResult =
  | { ok: true; boundaries: SprintBoundaries }
  | { ok: false; reason: "missing_start" | "missing_due" | "invalid_date" };

/**
 * Resolve timezone-aware sprint start/end and planning boundary.
 *
 * - Sprint start: start of milestone start date in configured timezone
 * - Sprint end: end of milestone due date in configured timezone
 * - Planning boundary:
 *   - allowFirstDayAdditions=true → end of first sprint calendar day
 *   - allowFirstDayAdditions=false → start of first sprint calendar day
 */
export function resolveSprintBoundaries(
  milestone: Pick<SprintMilestoneInput, "startDate" | "dueDate">,
  config: Pick<
    SprintIntelligenceRuleConfig,
    "timezone" | "allowFirstDayAdditions"
  >,
): SprintBoundaryResult {
  if (!milestone.startDate?.trim()) {
    return { ok: false, reason: "missing_start" };
  }
  if (!milestone.dueDate?.trim()) {
    return { ok: false, reason: "missing_due" };
  }

  const sprintStart = startOfDayInTimeZone(
    milestone.startDate,
    config.timezone,
  );
  const sprintEnd = endOfDayInTimeZone(milestone.dueDate, config.timezone);

  if (!sprintStart || !sprintEnd) {
    return { ok: false, reason: "invalid_date" };
  }

  const planningBoundary = config.allowFirstDayAdditions
    ? endOfDayInTimeZone(milestone.startDate, config.timezone)
    : sprintStart;

  if (!planningBoundary) {
    return { ok: false, reason: "invalid_date" };
  }

  return {
    ok: true,
    boundaries: {
      sprintStart,
      sprintEnd,
      planningBoundary,
    },
  };
}
