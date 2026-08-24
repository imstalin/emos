import { addDays, format, isSaturday, isSunday, parseISO } from "date-fns";

import type {
  ManagerProgressThresholds,
  ProgressIndicator,
} from "@/domain/types/manager-progress";

export interface AttentionRuleInput {
  workItemId: string;
  priorityName: string | null;
  priorityId: string | null;
  title: string;
  stage: string;
  progressToday: ProgressIndicator;
  lastMeaningfulProgressAt: Date | null;
  targetDate: Date | null;
  releaseDate: Date | null;
  activeWipCount: number;
  alignment: string;
  hasBlocker: boolean;
  ownerName: string | null;
}

export interface AttentionHit {
  ruleKey: string;
  title: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  workItemId: string;
  priorityId: string | null;
}

export function countWorkingDaysBetween(
  from: Date,
  to: Date,
  holidays: string[] = [],
): number {
  const holidaySet = new Set(holidays);
  let count = 0;
  let cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    cursor = addDays(cursor, 1);
    const key = format(cursor, "yyyy-MM-dd");
    if (isSaturday(cursor) || isSunday(cursor) || holidaySet.has(key)) {
      continue;
    }
    count += 1;
  }

  return count;
}

export function isHoliday(date: Date, holidays: string[]): boolean {
  return holidays.includes(format(date, "yyyy-MM-dd"));
}

export function evaluateAttentionRules(
  input: AttentionRuleInput,
  thresholds: ManagerProgressThresholds,
  holidays: string[] = [],
): AttentionHit[] {
  const hits: AttentionHit[] = [];
  const now = new Date();

  if (
    input.priorityName &&
    input.progressToday === "active_no_movement" &&
    input.lastMeaningfulProgressAt
  ) {
    const stagnantDays = countWorkingDaysBetween(
      input.lastMeaningfulProgressAt,
      now,
      holidays,
    );
    if (stagnantDays >= thresholds.highPriorityStagnationDays) {
      hits.push({
        ruleKey: "priority_stagnant",
        title: `${input.priorityName ?? input.title} has not moved`,
        description: `Priority has not had meaningful movement for ${stagnantDays} working day(s).`,
        severity: "WARNING",
        workItemId: input.workItemId,
        priorityId: input.priorityId,
      });
    }
  }

  if (input.stage === "code_review" && input.lastMeaningfulProgressAt) {
    const reviewDays = countWorkingDaysBetween(
      input.lastMeaningfulProgressAt,
      now,
      holidays,
    );
    if (reviewDays >= thresholds.mrReviewWaitingDays) {
      hits.push({
        ruleKey: "mr_review_waiting",
        title: `Review waiting: ${input.title}`,
        description: `MR waiting for review for ${reviewDays} working day(s).`,
        severity: "WARNING",
        workItemId: input.workItemId,
        priorityId: input.priorityId,
      });
    }
  }

  if (input.stage === "qa_ready" && input.lastMeaningfulProgressAt) {
    const qaDays = countWorkingDaysBetween(
      input.lastMeaningfulProgressAt,
      now,
      holidays,
    );
    if (qaDays >= thresholds.qaReadyWaitingDays) {
      hits.push({
        ruleKey: "qa_ready_waiting",
        title: `QA entry pending: ${input.title}`,
        description: `QA-ready item has not entered QA for ${qaDays} working day(s).`,
        severity: "WARNING",
        workItemId: input.workItemId,
        priorityId: input.priorityId,
      });
    }
  }

  if (input.releaseDate) {
    const daysToRelease = Math.ceil(
      (input.releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (
      daysToRelease <= thresholds.releaseProximityDays &&
      input.stage !== "completed" &&
      input.stage !== "production"
    ) {
      hits.push({
        ruleKey: "release_proximity",
        title: `Release approaching: ${input.title}`,
        description: `Release in ${daysToRelease} day(s) with work still in ${input.stage}.`,
        severity: daysToRelease <= 1 ? "CRITICAL" : "WARNING",
        workItemId: input.workItemId,
        priorityId: input.priorityId,
      });
    }
  }

  if (input.activeWipCount > thresholds.maxActiveWip) {
    hits.push({
      ruleKey: "excessive_wip",
      title: `Possible context-switching risk: ${input.ownerName ?? "Member"}`,
      description: `Active WIP: ${input.activeWipCount}. Recommended: ${thresholds.maxActiveWip}.`,
      severity: "INFO",
      workItemId: input.workItemId,
      priorityId: input.priorityId,
    });
  }

  if (input.alignment === "UNPLANNED" && input.priorityName) {
    hits.push({
      ruleKey: "unplanned_work",
      title: `Unplanned work detected: ${input.title}`,
      description: "Significant unplanned work may be displacing committed priorities.",
      severity: "INFO",
      workItemId: input.workItemId,
      priorityId: input.priorityId,
    });
  }

  if (input.hasBlocker) {
    hits.push({
      ruleKey: "active_blocker",
      title: `Blocked: ${input.title}`,
      description: "Work item has an active blocker requiring attention.",
      severity: "CRITICAL",
      workItemId: input.workItemId,
      priorityId: input.priorityId,
    });
  }

  if (!input.ownerName) {
    hits.push({
      ruleKey: "missing_owner",
      title: `Missing owner: ${input.title}`,
      description: "Work item has no assigned owner.",
      severity: "INFO",
      workItemId: input.workItemId,
      priorityId: input.priorityId,
    });
  }

  if (input.priorityName && !input.targetDate) {
    hits.push({
      ruleKey: "missing_target_date",
      title: `Missing target date: ${input.priorityName}`,
      description: "Priority work item is missing a target date.",
      severity: "INFO",
      workItemId: input.workItemId,
      priorityId: input.priorityId,
    });
  }

  return hits;
}

export function parseConfigDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}
