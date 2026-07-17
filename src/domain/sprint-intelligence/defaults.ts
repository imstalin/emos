import type {
  ManagedOutcomeLabels,
  SprintIntelligenceRuleConfig,
  WorkType,
} from "@/domain/types/sprint-intelligence";

export const DEFAULT_MANAGED_OUTCOME_LABELS: ManagedOutcomeLabels = {
  planned: "sprint::planned",
  committed: "sprint::committed",
  spillover: "sprint::spillover",
  completedUnplanned: "sprint::completed-unplanned",
  unplanned: "unplanned",
};

/**
 * Default label → work-type map.
 * Includes automation labels and aliases for the existing Type:: / qa:: taxonomy.
 */
export const DEFAULT_WORK_TYPE_ALIASES: Record<string, WorkType> = {
  "work::bug": "bug",
  "work::enhancement": "enhancement",
  "work::tech-debt": "tech_debt",
  "work::support": "support",
  "work::hotfix": "hotfix",
  "qa::regression": "regression",
  "qa::testing": "functional_testing",
  "qa::uat": "uat",
  "release::validation": "release_validation",
  "release::deployment": "deployment",
  // Existing GitLab taxonomy aliases
  "Type::Defect": "bug",
  "Type::Enhancement": "enhancement",
  "Type::Technical Debt": "tech_debt",
  "Type::Support": "support",
  "Type::Hotfix": "hotfix",
  "Type::Bug": "bug",
};

export const DEFAULT_SPRINT_INTELLIGENCE_CONFIG: SprintIntelligenceRuleConfig = {
  timezone: "Asia/Kolkata",
  allowFirstDayAdditions: true,
  supportExcludedFromCommitment: true,
  hotfixExcludedFromCommitment: true,
  uatExcludedFromCommitment: false,
  completionStates: ["closed"],
  managedLabels: { ...DEFAULT_MANAGED_OUTCOME_LABELS },
  workTypeAliases: { ...DEFAULT_WORK_TYPE_ALIASES },
  auditHistoryMode: false,
};

/** All managed outcome label values for a config. */
export function managedOutcomeLabelSet(
  managed: ManagedOutcomeLabels,
): Set<string> {
  return new Set([
    managed.planned,
    managed.committed,
    managed.spillover,
    managed.completedUnplanned,
    managed.unplanned,
  ]);
}
