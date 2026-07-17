import type {
  DeliveryStatus,
  LabelPlan,
  ManagedOutcomeLabels,
  PlanningStatus,
  SprintIntelligenceRuleConfig,
} from "@/domain/types/sprint-intelligence";

import { managedOutcomeLabelSet } from "./defaults";

export interface LabelPlannerInput {
  planningStatus: PlanningStatus;
  deliveryStatus: DeliveryStatus;
  existingLabels: string[];
  managedLabels: ManagedOutcomeLabels;
  /**
   * Labels previously applied by this automation (subset of managed labels).
   * Only these may be removed. When omitted, any managed outcome label present
   * may be corrected (Phase 2 default for idempotent planning).
   */
  automationOwnedLabels?: string[];
}

/**
 * Desired managed outcome labels for a classification result.
 * Never includes contradictory pairs (committed + spillover).
 */
export function desiredManagedLabels(params: {
  planningStatus: PlanningStatus;
  deliveryStatus: DeliveryStatus;
  managedLabels: ManagedOutcomeLabels;
}): string[] {
  const { planningStatus, deliveryStatus, managedLabels } = params;
  const desired: string[] = [];

  if (
    planningStatus === "UnableToDetermine" ||
    planningStatus === "NotApplicable" ||
    deliveryStatus === "UnableToDetermine" ||
    deliveryStatus === "NotApplicable"
  ) {
    return desired;
  }

  if (planningStatus === "Planned") {
    desired.push(managedLabels.planned);
  }

  if (planningStatus === "Unplanned") {
    desired.push(managedLabels.unplanned);
  }

  switch (deliveryStatus) {
    case "Committed":
      desired.push(managedLabels.committed);
      break;
    case "Spillover":
      desired.push(managedLabels.spillover);
      break;
    case "CompletedUnplanned":
      desired.push(managedLabels.completedUnplanned);
      break;
    case "OpenUnplanned":
    case "Excluded":
      break;
  }

  return unique(desired);
}

/**
 * Plan add/remove actions for automation-owned outcome labels only.
 * Never removes non-managed / user labels.
 * Idempotent when existing labels already match the desired set.
 */
export function planManagedLabelActions(input: LabelPlannerInput): LabelPlan {
  const desired = desiredManagedLabels(input);
  const managedSet = managedOutcomeLabelSet(input.managedLabels);
  const existing = new Set(input.existingLabels);

  const removable = new Set(
    (input.automationOwnedLabels ?? [...managedSet]).filter((label) =>
      managedSet.has(label),
    ),
  );

  const labelsToAdd = desired.filter((label) => !existing.has(label));

  const managedLabelsToRemove = [...existing].filter(
    (label) =>
      managedSet.has(label) &&
      removable.has(label) &&
      !desired.includes(label),
  );

  return {
    labelsToAdd,
    managedLabelsToRemove,
    desiredManagedLabels: desired,
  };
}

export function planManagedLabelActionsForConfig(
  input: Omit<LabelPlannerInput, "managedLabels"> & {
    config: Pick<SprintIntelligenceRuleConfig, "managedLabels">;
  },
): LabelPlan {
  return planManagedLabelActions({
    planningStatus: input.planningStatus,
    deliveryStatus: input.deliveryStatus,
    existingLabels: input.existingLabels,
    managedLabels: input.config.managedLabels,
    automationOwnedLabels: input.automationOwnedLabels,
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
