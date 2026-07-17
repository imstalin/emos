import { describe, expect, it } from "vitest";

import {
  desiredManagedLabels,
  planManagedLabelActions,
} from "./label-planner";
import { DEFAULT_MANAGED_OUTCOME_LABELS } from "./defaults";

const ML = DEFAULT_MANAGED_OUTCOME_LABELS;

describe("desiredManagedLabels", () => {
  it("never returns both committed and spillover", () => {
    expect(
      desiredManagedLabels({
        planningStatus: "Planned",
        deliveryStatus: "Committed",
        managedLabels: ML,
      }),
    ).toEqual([ML.planned, ML.committed]);

    expect(
      desiredManagedLabels({
        planningStatus: "Planned",
        deliveryStatus: "Spillover",
        managedLabels: ML,
      }),
    ).toEqual([ML.planned, ML.spillover]);
  });

  it("keeps unplanned with completed-unplanned", () => {
    expect(
      desiredManagedLabels({
        planningStatus: "Unplanned",
        deliveryStatus: "CompletedUnplanned",
        managedLabels: ML,
      }),
    ).toEqual([ML.unplanned, ML.completedUnplanned]);
  });

  it("applies no outcome labels for UnableToDetermine", () => {
    expect(
      desiredManagedLabels({
        planningStatus: "UnableToDetermine",
        deliveryStatus: "UnableToDetermine",
        managedLabels: ML,
      }),
    ).toEqual([]);
  });

  it("planned + excluded → only planned", () => {
    expect(
      desiredManagedLabels({
        planningStatus: "Planned",
        deliveryStatus: "Excluded",
        managedLabels: ML,
      }),
    ).toEqual([ML.planned]);
  });
});

describe("planManagedLabelActions", () => {
  it("24. dry-run style plan makes no assumption of apply — only returns actions", () => {
    const plan = planManagedLabelActions({
      planningStatus: "Planned",
      deliveryStatus: "Committed",
      existingLabels: ["Type::Defect"],
      managedLabels: ML,
    });
    expect(plan.labelsToAdd).toEqual([ML.planned, ML.committed]);
    expect(plan.managedLabelsToRemove).toEqual([]);
  });

  it("25. is idempotent when labels already match", () => {
    const plan = planManagedLabelActions({
      planningStatus: "Planned",
      deliveryStatus: "Committed",
      existingLabels: [ML.planned, ML.committed, "Type::Defect"],
      managedLabels: ML,
    });
    expect(plan.labelsToAdd).toEqual([]);
    expect(plan.managedLabelsToRemove).toEqual([]);
  });

  it("23. never plans duplicate adds", () => {
    const plan = planManagedLabelActions({
      planningStatus: "Unplanned",
      deliveryStatus: "CompletedUnplanned",
      existingLabels: [ML.unplanned],
      managedLabels: ML,
    });
    expect(plan.labelsToAdd).toEqual([ML.completedUnplanned]);
    expect(plan.labelsToAdd.filter((l) => l === ML.unplanned)).toHaveLength(0);
  });

  it("only removes automation-owned managed labels", () => {
    const plan = planManagedLabelActions({
      planningStatus: "Planned",
      deliveryStatus: "Spillover",
      existingLabels: [ML.planned, ML.committed, "Type::Defect"],
      managedLabels: ML,
      automationOwnedLabels: [ML.committed],
    });
    expect(plan.labelsToAdd).toContain(ML.spillover);
    expect(plan.managedLabelsToRemove).toEqual([ML.committed]);
    expect(plan.managedLabelsToRemove).not.toContain("Type::Defect");
  });

  it("does not remove managed labels that are not automation-owned", () => {
    const plan = planManagedLabelActions({
      planningStatus: "Unplanned",
      deliveryStatus: "OpenUnplanned",
      existingLabels: [ML.planned, ML.unplanned],
      managedLabels: ML,
      automationOwnedLabels: [ML.unplanned],
    });
    // planned is present but not automation-owned → not removed
    expect(plan.managedLabelsToRemove).toEqual([]);
  });
});
