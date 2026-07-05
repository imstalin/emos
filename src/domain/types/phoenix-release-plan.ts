export type PhoenixReleasePlanMode = "main" | "dev-qa";

export interface PhoenixReleasePlanJobInfo {
  name: string;
  stage: string;
  status: string;
  webUrl: string;
}

export interface PhoenixReleasePlanPipelineInfo {
  status: string | null;
  webUrl: string | null;
  jobs: PhoenixReleasePlanJobInfo[];
}

export interface PhoenixReleasePlanProjectRow {
  projectName: string;
  projectWebUrl: string;
  deployVersion: string | null;
  deployPipelineUrl: string | null;
  deployPipeline: PhoenixReleasePlanPipelineInfo | null;
  rollbackVersion: string | null;
  rollbackPipelineUrl: string | null;
  rollbackPipeline: PhoenixReleasePlanPipelineInfo | null;
  compareUrl: string | null;
  error: string | null;
}

export interface PhoenixReleasePlanGroupSection {
  groupId: string;
  groupName: string | null;
  rows: PhoenixReleasePlanProjectRow[];
  error: string | null;
}

export interface PhoenixReleasePlanPreview {
  mode: PhoenixReleasePlanMode;
  title: string;
  generatedAt: string;
  markdown: string;
  sections: PhoenixReleasePlanGroupSection[];
  issueProjectId: number | null;
  issueProjectConfigured: boolean;
}

export interface PhoenixReleasePlanIssueResult {
  issueIid: number;
  issueWebUrl: string;
  title: string;
}
