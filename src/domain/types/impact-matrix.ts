import type { PhoenixReleasePlanMode } from "@/domain/types/phoenix-release-plan";

export type ImpactRisk = "high" | "medium" | "low";
export type RegressionScope = "smoke" | "targeted" | "full";
export type TestAutomation = "automated" | "manual" | "mixed";

export interface ImpactMatrixChangedRepo {
  groupId: string;
  projectName: string;
  projectWebUrl: string;
  deployVersion: string;
  rollbackVersion: string | null;
  compareUrl: string | null;
  category: string;
  flows: string[];
  risk: ImpactRisk;
  testSuites: string[];
  automation: TestAutomation;
  mapped: boolean;
}

export interface ImpactMatrixFlowRow {
  flow: string;
  triggeredRepos: string[];
  risk: ImpactRisk;
  regressionScope: RegressionScope;
  testSuites: string[];
  automation: TestAutomation;
}

export interface ImpactMatrixSummary {
  changedRepoCount: number;
  mappedRepoCount: number;
  unmappedRepoCount: number;
  flowCount: number;
  highRiskFlowCount: number;
  recommendedRegression: RegressionScope;
}

export interface ImpactMatrixPreview {
  mode: PhoenixReleasePlanMode;
  title: string;
  generatedAt: string;
  markdown: string;
  changedRepos: ImpactMatrixChangedRepo[];
  flowRows: ImpactMatrixFlowRow[];
  summary: ImpactMatrixSummary;
  releasePlanTitle: string;
  issueProjectId: number | null;
  issueProjectConfigured: boolean;
}

export interface ImpactMatrixIssueResult {
  issueIid: number;
  issueWebUrl: string;
  title: string;
}
