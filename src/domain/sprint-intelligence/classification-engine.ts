import type {
  DeliveryStatus,
  PlanningStatus,
  SprintIntelligenceIssueInput,
  SprintIntelligenceReasonCode,
  SprintIntelligenceRuleConfig,
  SprintIssueEvaluation,
  SprintMilestoneInput,
} from "@/domain/types/sprint-intelligence";

import { planManagedLabelActions } from "./label-planner";
import { resolveMilestoneAssignment } from "./milestone-event-resolver";
import { resolveSprintBoundaries } from "./sprint-boundary";
import { toDate } from "./timezone";
import {
  isExcludedFromCommitment,
  resolveWorkTypes,
} from "./work-type-resolver";

export interface EvaluateIssueOptions {
  evaluatedAt?: Date;
  automationOwnedLabels?: string[];
}

/**
 * Classify a single issue for a target milestone.
 * Pure function — no I/O.
 */
export function evaluateSprintIssue(
  issue: SprintIntelligenceIssueInput,
  milestone: SprintMilestoneInput,
  config: SprintIntelligenceRuleConfig,
  options: EvaluateIssueOptions = {},
): SprintIssueEvaluation {
  const evaluatedAt = options.evaluatedAt ?? new Date();
  const reasonCodes: SprintIntelligenceReasonCode[] = [];
  const workTypes = resolveWorkTypes(issue.labels, config);
  const exclusion = isExcludedFromCommitment(workTypes, config);
  reasonCodes.push(...exclusion.reasons);

  const base = {
    projectId: issue.projectId,
    issueId: issue.issueId,
    issueIid: issue.issueIid,
    title: issue.title,
    state: issue.state,
    milestoneId: milestone.id,
    milestoneTitle: milestone.title,
    workTypes,
    excludedFromCommitment: exclusion.excluded,
    existingLabels: [...issue.labels],
    assignees: issue.assignees,
    evaluatedAt,
    closedAt: issue.closedAt ? toDate(issue.closedAt) : null,
  };

  const boundariesResult = resolveSprintBoundaries(milestone, config);
  if (!boundariesResult.ok) {
    reasonCodes.push("MILESTONE_DATES_MISSING");
    return finalize(base, {
      assignmentTimestamp: null,
      milestoneRemovalTimestamp: null,
      assignmentUserId: null,
      assignmentUserName: null,
      sprintStart: null,
      sprintEnd: null,
      planningStatus: "UnableToDetermine",
      deliveryStatus: "UnableToDetermine",
      completedWithinSprint: false,
      reasonCodes,
      config,
      automationOwnedLabels: options.automationOwnedLabels,
    });
  }

  const { boundaries } = boundariesResult;
  const assignment = resolveMilestoneAssignment({
    targetMilestoneId: milestone.id,
    currentMilestoneId: issue.currentMilestoneId,
    events: issue.milestoneEvents,
  });

  if (assignment.kind === "unavailable") {
    reasonCodes.push(assignment.reasonCode);
    return finalize(base, {
      assignmentTimestamp: null,
      milestoneRemovalTimestamp: null,
      assignmentUserId: null,
      assignmentUserName: null,
      sprintStart: boundaries.sprintStart,
      sprintEnd: boundaries.sprintEnd,
      planningStatus: "UnableToDetermine",
      deliveryStatus: "UnableToDetermine",
      completedWithinSprint: false,
      reasonCodes,
      config,
      automationOwnedLabels: options.automationOwnedLabels,
    });
  }

  if (assignment.kind === "inactive" && !config.auditHistoryMode) {
    reasonCodes.push(assignment.reasonCode);
    reasonCodes.push("NOT_ON_TARGET_MILESTONE");
    return finalize(base, {
      assignmentTimestamp: assignment.cycle?.assignedAt ?? null,
      milestoneRemovalTimestamp: assignment.cycle?.removedAt ?? null,
      assignmentUserId: assignment.cycle?.assignedByUserId ?? null,
      assignmentUserName: assignment.cycle?.assignedByUserName ?? null,
      sprintStart: boundaries.sprintStart,
      sprintEnd: boundaries.sprintEnd,
      planningStatus: "NotApplicable",
      deliveryStatus: "NotApplicable",
      completedWithinSprint: false,
      reasonCodes: uniqueReasons(reasonCodes),
      config,
      automationOwnedLabels: options.automationOwnedLabels,
    });
  }

  if (assignment.kind === "inactive" && config.auditHistoryMode) {
    reasonCodes.push(assignment.reasonCode);
    reasonCodes.push("AUDIT_HISTORY_MODE");
  }

  const cycle =
    assignment.kind === "active" ? assignment.cycle : assignment.cycle;

  if (!cycle) {
    reasonCodes.push("MILESTONE_HISTORY_UNAVAILABLE");
    return finalize(base, {
      assignmentTimestamp: null,
      milestoneRemovalTimestamp: null,
      assignmentUserId: null,
      assignmentUserName: null,
      sprintStart: boundaries.sprintStart,
      sprintEnd: boundaries.sprintEnd,
      planningStatus: "UnableToDetermine",
      deliveryStatus: "UnableToDetermine",
      completedWithinSprint: false,
      reasonCodes,
      config,
      automationOwnedLabels: options.automationOwnedLabels,
    });
  }

  if (cycle.wasReassigned) {
    reasonCodes.push("MILESTONE_REMOVED_AND_REASSIGNED");
  }

  const assignedAt = cycle.assignedAt;
  const planningStatus = resolvePlanningStatus(
    assignedAt,
    boundaries.sprintStart,
    boundaries.planningBoundary,
    config.allowFirstDayAdditions,
    reasonCodes,
  );

  const completion = resolveCompletion(issue, config, boundaries.sprintEnd, reasonCodes);

  const deliveryStatus = resolveDeliveryStatus({
    planningStatus,
    excluded: exclusion.excluded,
    isComplete: completion.isComplete,
    completedWithinSprint: completion.completedWithinSprint,
    reasonCodes,
  });

  return finalize(base, {
    assignmentTimestamp: assignedAt,
    milestoneRemovalTimestamp: cycle.removedAt,
    assignmentUserId: cycle.assignedByUserId,
    assignmentUserName: cycle.assignedByUserName,
    sprintStart: boundaries.sprintStart,
    sprintEnd: boundaries.sprintEnd,
    planningStatus,
    deliveryStatus,
    completedWithinSprint: completion.completedWithinSprint,
    reasonCodes: uniqueReasons(reasonCodes),
    config,
    automationOwnedLabels: options.automationOwnedLabels,
  });
}

function resolvePlanningStatus(
  assignedAt: Date,
  sprintStart: Date,
  planningBoundary: Date,
  allowFirstDayAdditions: boolean,
  reasonCodes: SprintIntelligenceReasonCode[],
): PlanningStatus {
  if (assignedAt.getTime() > planningBoundary.getTime()) {
    reasonCodes.push("ASSIGNED_AFTER_SPRINT_BOUNDARY");
    return "Unplanned";
  }

  const assignedAfterSprintStart = assignedAt.getTime() > sprintStart.getTime();
  if (allowFirstDayAdditions && assignedAfterSprintStart) {
    reasonCodes.push("ASSIGNED_DURING_ALLOWED_FIRST_DAY");
  } else {
    reasonCodes.push("ASSIGNED_BEFORE_SPRINT_BOUNDARY");
  }

  return "Planned";
}

function resolveCompletion(
  issue: SprintIntelligenceIssueInput,
  config: SprintIntelligenceRuleConfig,
  sprintEnd: Date,
  reasonCodes: SprintIntelligenceReasonCode[],
): { isComplete: boolean; completedWithinSprint: boolean } {
  const stateComplete = config.completionStates.some(
    (state) => state.toLowerCase() === issue.state.toLowerCase(),
  );

  // Reopened: state not complete → not completed, even if a stale closedAt exists.
  if (!stateComplete) {
    if (issue.closedAt) {
      reasonCodes.push("REOPENED_ISSUE");
    } else {
      reasonCodes.push("OPEN_AT_SPRINT_END");
    }
    return { isComplete: false, completedWithinSprint: false };
  }

  if (!issue.closedAt) {
    reasonCodes.push("OPEN_AT_SPRINT_END");
    return { isComplete: false, completedWithinSprint: false };
  }

  const closedAt = toDate(issue.closedAt);
  const within = closedAt.getTime() <= sprintEnd.getTime();

  if (within) {
    reasonCodes.push("CLOSED_WITHIN_SPRINT");
  } else {
    reasonCodes.push("CLOSED_AFTER_SPRINT");
  }

  return { isComplete: true, completedWithinSprint: within };
}

function resolveDeliveryStatus(params: {
  planningStatus: PlanningStatus;
  excluded: boolean;
  isComplete: boolean;
  completedWithinSprint: boolean;
  reasonCodes: SprintIntelligenceReasonCode[];
}): DeliveryStatus {
  const { planningStatus, excluded, isComplete, completedWithinSprint, reasonCodes } =
    params;

  if (planningStatus === "Planned") {
    if (excluded) {
      // Commitment-excluded planned work is never Committed or Spillover.
      // Open vs completed is reported via completedWithinSprint / state.
      return "Excluded";
    }

    if (isComplete && completedWithinSprint) {
      return "Committed";
    }
    return "Spillover";
  }

  if (planningStatus === "Unplanned") {
    if (isComplete && completedWithinSprint) {
      reasonCodes.push("COMPLETED_UNPLANNED");
      return "CompletedUnplanned";
    }
    return "OpenUnplanned";
  }

  return "UnableToDetermine";
}

function finalize(
  base: {
    projectId: number;
    issueId: number;
    issueIid: number;
    title: string;
    state: string;
    milestoneId: number;
    milestoneTitle: string;
    workTypes: SprintIssueEvaluation["workTypes"];
    excludedFromCommitment: boolean;
    existingLabels: string[];
    assignees: SprintIssueEvaluation["assignees"];
    evaluatedAt: Date;
    closedAt: Date | null;
  },
  rest: {
    assignmentTimestamp: Date | null;
    milestoneRemovalTimestamp: Date | null;
    assignmentUserId: number | null;
    assignmentUserName: string | null;
    sprintStart: Date | null;
    sprintEnd: Date | null;
    planningStatus: PlanningStatus;
    deliveryStatus: DeliveryStatus;
    completedWithinSprint: boolean;
    reasonCodes: SprintIntelligenceReasonCode[];
    config: SprintIntelligenceRuleConfig;
    automationOwnedLabels?: string[];
  },
): SprintIssueEvaluation {
  const labelPlan = planManagedLabelActions({
    planningStatus: rest.planningStatus,
    deliveryStatus: rest.deliveryStatus,
    existingLabels: base.existingLabels,
    managedLabels: rest.config.managedLabels,
    automationOwnedLabels: rest.automationOwnedLabels,
  });

  return {
    ...base,
    assignmentTimestamp: rest.assignmentTimestamp,
    milestoneRemovalTimestamp: rest.milestoneRemovalTimestamp,
    assignmentUserId: rest.assignmentUserId,
    assignmentUserName: rest.assignmentUserName,
    sprintStart: rest.sprintStart,
    sprintEnd: rest.sprintEnd,
    planningStatus: rest.planningStatus,
    deliveryStatus: rest.deliveryStatus,
    completedWithinSprint: rest.completedWithinSprint,
    labelsToAdd: labelPlan.labelsToAdd,
    managedLabelsToRemove: labelPlan.managedLabelsToRemove,
    reasonCodes: rest.reasonCodes,
  };
}

function uniqueReasons(
  codes: SprintIntelligenceReasonCode[],
): SprintIntelligenceReasonCode[] {
  return [...new Set(codes)];
}

/**
 * Evaluate all issues for a milestone.
 */
export function evaluateSprintIssues(
  issues: SprintIntelligenceIssueInput[],
  milestone: SprintMilestoneInput,
  config: SprintIntelligenceRuleConfig,
  options: EvaluateIssueOptions = {},
): SprintIssueEvaluation[] {
  return issues.map((issue) =>
    evaluateSprintIssue(issue, milestone, config, options),
  );
}
