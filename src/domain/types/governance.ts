export interface GovernanceViolation {
  ruleId: string;
  ruleSlug: string;
  ruleName: string;
  severity: string;
  category: string;
  description: string | null;
  workItemId: string;
  workItemTitle: string;
  workItemType: string;
  projectName: string;
  assigneeName: string | null;
  webUrl: string | null;
}

export interface GovernanceRuleSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  severity: string;
  description: string | null;
  violationCount: number;
}

export interface GovernanceReport {
  generatedAt: string;
  score: number;
  totalItems: number;
  violationCount: number;
  violationsBySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  violationsByCategory: Record<string, number>;
  rules: GovernanceRuleSummary[];
  violations: GovernanceViolation[];
}
