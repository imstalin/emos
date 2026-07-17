import type {
  SprintIntelligenceRuleConfig,
  WorkType,
} from "@/domain/types/sprint-intelligence";

/**
 * Resolve canonical work types from issue labels using configured aliases.
 * An issue may have multiple work types.
 */
export function resolveWorkTypes(
  labels: string[],
  config: Pick<SprintIntelligenceRuleConfig, "workTypeAliases">,
): WorkType[] {
  const found = new Set<WorkType>();

  for (const label of labels) {
    const mapped = config.workTypeAliases[label];
    if (mapped) {
      found.add(mapped);
    }
  }

  if (found.size === 0) {
    return ["other"];
  }

  return [...found].sort();
}

export type ExclusionReasonCode =
  | "EXCLUDED_SUPPORT"
  | "EXCLUDED_HOTFIX"
  | "EXCLUDED_UAT";

export function isExcludedFromCommitment(
  workTypes: WorkType[],
  config: Pick<
    SprintIntelligenceRuleConfig,
    | "supportExcludedFromCommitment"
    | "hotfixExcludedFromCommitment"
    | "uatExcludedFromCommitment"
  >,
): { excluded: boolean; reasons: ExclusionReasonCode[] } {
  const reasons: ExclusionReasonCode[] = [];

  if (config.supportExcludedFromCommitment && workTypes.includes("support")) {
    reasons.push("EXCLUDED_SUPPORT");
  }
  if (config.hotfixExcludedFromCommitment && workTypes.includes("hotfix")) {
    reasons.push("EXCLUDED_HOTFIX");
  }
  if (config.uatExcludedFromCommitment && workTypes.includes("uat")) {
    reasons.push("EXCLUDED_UAT");
  }

  return {
    excluded: reasons.length > 0,
    reasons,
  };
}
