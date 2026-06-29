type GovernanceItem = {
  type: string;
  priority: string;
  storyPoints: number | null;
  labels: string[];
  dueDate: Date | null;
  lastActivityAt: Date | null;
  reviewStatus: string | null;
};

type RuleConfig = {
  maxStoryPoints?: number;
  inactiveDays?: number;
};

export function evaluateGovernanceRule(
  slug: string,
  item: GovernanceItem,
  config: RuleConfig = {},
): boolean {
  switch (slug) {
    case "missing-estimate":
      return item.storyPoints == null && item.type === "ISSUE";

    case "missing-labels":
      return item.labels.length === 0;

    case "missing-due-date":
      return (
        (item.priority === "HIGH" || item.priority === "CRITICAL") &&
        item.dueDate == null
      );

    case "oversized-story":
      const maxPoints = config.maxStoryPoints ?? 8;
      return (
        item.type === "ISSUE" &&
        item.storyPoints != null &&
        item.storyPoints > maxPoints
      );

    case "inactive-issue":
      const inactiveDays = config.inactiveDays ?? 5;
      if (!item.lastActivityAt) return item.type === "ISSUE";
      const daysSince =
        (Date.now() - item.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
      return item.type === "ISSUE" && daysSince >= inactiveDays;

    case "failed-pipeline":
      const reviewStatus = item.reviewStatus?.toLowerCase() ?? "";
      return (
        item.type === "MERGE_REQUEST" &&
        (reviewStatus.includes("fail") ||
          reviewStatus === "cannot_be_merged" ||
          item.labels.some((label) => label.toLowerCase() === "pipeline-failed"))
      );

    default:
      return false;
  }
}
