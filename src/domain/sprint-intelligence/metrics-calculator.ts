import type {
  SprintIssueEvaluation,
  SprintMetrics,
  WorkType,
} from "@/domain/types/sprint-intelligence";

function hasWorkType(
  evaluation: SprintIssueEvaluation,
  workType: WorkType,
): boolean {
  return evaluation.workTypes.includes(workType);
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Active sprint issues for metric denominators (excludes UnableToDetermine / NotApplicable).
 */
function isActiveSprintIssue(evaluation: SprintIssueEvaluation): boolean {
  return (
    evaluation.planningStatus === "Planned" ||
    evaluation.planningStatus === "Unplanned"
  );
}

/**
 * Planned issues eligible for commitment reliability / spillover %.
 */
function isCommitmentEligible(evaluation: SprintIssueEvaluation): boolean {
  return (
    evaluation.planningStatus === "Planned" &&
    !evaluation.excludedFromCommitment
  );
}

export function calculateSprintMetrics(
  evaluations: SprintIssueEvaluation[],
): SprintMetrics {
  const active = evaluations.filter(isActiveSprintIssue);
  const plannedEligible = evaluations.filter(isCommitmentEligible);

  const plannedCount = evaluations.filter(
    (item) => item.planningStatus === "Planned",
  ).length;

  const plannedCompletedCount = plannedEligible.filter(
    (item) => item.deliveryStatus === "Committed",
  ).length;

  const committedCount = evaluations.filter(
    (item) => item.deliveryStatus === "Committed",
  ).length;

  const spilloverCount = plannedEligible.filter(
    (item) => item.deliveryStatus === "Spillover",
  ).length;

  const unplannedCount = evaluations.filter(
    (item) => item.planningStatus === "Unplanned",
  ).length;

  const completedUnplannedCount = evaluations.filter(
    (item) => item.deliveryStatus === "CompletedUnplanned",
  ).length;

  const completedSprintIssues = evaluations.filter(
    (item) =>
      isActiveSprintIssue(item) &&
      (item.deliveryStatus === "Committed" ||
        item.deliveryStatus === "CompletedUnplanned" ||
        (item.deliveryStatus === "Excluded" && item.completedWithinSprint)),
  ).length;

  const regressionIssues = active.filter((item) =>
    hasWorkType(item, "regression"),
  );
  const plannedRegressionCount = regressionIssues.filter(
    (item) => item.planningStatus === "Planned",
  ).length;
  const unplannedRegressionCount = regressionIssues.filter(
    (item) => item.planningStatus === "Unplanned",
  ).length;

  return {
    plannedCount,
    plannedCompletedCount,
    committedCount,
    spilloverCount,
    unplannedCount,
    completedUnplannedCount,
    regressionCount: regressionIssues.length,
    plannedRegressionCount,
    unplannedRegressionCount,
    supportCount: active.filter((item) => hasWorkType(item, "support")).length,
    hotfixCount: active.filter((item) => hasWorkType(item, "hotfix")).length,
    bugCount: active.filter((item) => hasWorkType(item, "bug")).length,
    enhancementCount: active.filter((item) =>
      hasWorkType(item, "enhancement"),
    ).length,
    technicalDebtCount: active.filter((item) =>
      hasWorkType(item, "tech_debt"),
    ).length,
    releaseValidationCount: active.filter((item) =>
      hasWorkType(item, "release_validation"),
    ).length,
    deploymentCount: active.filter((item) =>
      hasWorkType(item, "deployment"),
    ).length,
    functionalTestingCount: active.filter((item) =>
      hasWorkType(item, "functional_testing"),
    ).length,
    uatCount: active.filter((item) => hasWorkType(item, "uat")).length,
    commitmentReliabilityPercent: percent(
      plannedCompletedCount,
      plannedEligible.length,
    ),
    spilloverPercent: percent(spilloverCount, plannedEligible.length),
    unplannedWorkPercent: percent(unplannedCount, active.length),
    completedUnplannedPercent: percent(
      completedUnplannedCount,
      completedSprintIssues,
    ),
    regressionSharePercent: percent(regressionIssues.length, active.length),
  };
}
