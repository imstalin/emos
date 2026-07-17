import type {
  ResourceMilestoneEvent,
  SprintIntelligenceIssueInput,
  SprintIntelligenceRuleConfig,
  SprintMilestoneInput,
} from "@/domain/types/sprint-intelligence";

import { DEFAULT_SPRINT_INTELLIGENCE_CONFIG } from "./defaults";
import { endOfDayInTimeZone, startOfDayInTimeZone } from "./timezone";

export const SPRINT: SprintMilestoneInput = {
  id: 100,
  title: "Sprint 42",
  startDate: "2026-07-06",
  dueDate: "2026-07-17",
};

export function config(
  overrides: Partial<SprintIntelligenceRuleConfig> = {},
): SprintIntelligenceRuleConfig {
  return {
    ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    managedLabels: { ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels },
    workTypeAliases: { ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG.workTypeAliases },
    completionStates: [...DEFAULT_SPRINT_INTELLIGENCE_CONFIG.completionStates],
    ...overrides,
  };
}

export function kolkataStart(dateYmd: string): Date {
  return startOfDayInTimeZone(dateYmd, "Asia/Kolkata")!;
}

export function kolkataEnd(dateYmd: string): Date {
  return endOfDayInTimeZone(dateYmd, "Asia/Kolkata")!;
}

/** ISO instant helpers for Asia/Kolkata wall times. */
export function ist(dateYmd: string, time = "12:00:00.000"): string {
  return `${dateYmd}T${time}+05:30`;
}

export function addEvent(
  overrides: Partial<ResourceMilestoneEvent> &
    Pick<ResourceMilestoneEvent, "id" | "createdAt" | "action">,
): ResourceMilestoneEvent {
  return {
    milestoneId: SPRINT.id,
    userId: 1,
    userName: "planner",
    ...overrides,
  };
}

export function issue(
  overrides: Partial<SprintIntelligenceIssueInput> &
    Pick<SprintIntelligenceIssueInput, "issueIid">,
): SprintIntelligenceIssueInput {
  const assignedAt = overrides.milestoneEvents?.[0]
    ? undefined
    : ist("2026-07-05", "10:00:00.000");

  return {
    projectId: 6100,
    issueId: overrides.issueIid * 10,
    title: `Issue ${overrides.issueIid}`,
    state: "opened",
    labels: [],
    assignees: [{ id: 7, username: "dev" }],
    createdAt: ist("2026-06-01", "09:00:00.000"),
    closedAt: null,
    currentMilestoneId: SPRINT.id,
    milestoneEvents: [
      addEvent({
        id: 1,
        action: "add",
        createdAt: assignedAt ?? ist("2026-07-05", "10:00:00.000"),
      }),
    ],
    ...overrides,
  };
}
