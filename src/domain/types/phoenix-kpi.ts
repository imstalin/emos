export interface PhoenixMonthColumn {
  key: string;
  label: string;
  endDate: string;
}

export interface PhoenixKpiMonthValue {
  monthKey: string;
  remarks: string | null;
  score: number | null;
  automated: boolean;
  evidence: string | null;
}

export interface PhoenixKpiRow {
  id: string;
  category: string | null;
  kpi: string;
  applicable: boolean;
  measure: string | null;
  definitionRemarks: string | null;
  unit: string | null;
  benchmark: string | null;
  targetScore: string | number | null;
  ytdScore: number | null;
  monthly: PhoenixKpiMonthValue[];
}

export interface PhoenixKpiDocument {
  team: string;
  fiscalYear: string;
  sheetName: string;
  months: PhoenixMonthColumn[];
  rows: PhoenixKpiRow[];
}

export interface PhoenixKpiData {
  id: string;
  slug: string;
  team: string;
  fiscalYear: string;
  document: PhoenixKpiDocument;
  updatedAt: string;
}

export interface PhoenixAutomateResult {
  document: PhoenixKpiDocument;
  updatedKpis: string[];
  skippedKpis: string[];
}

export interface PhoenixMemberKpiMetricRow {
  kpiId: string;
  category: string | null;
  kpi: string;
  monthly: PhoenixKpiMonthValue[];
  ytdScore: number | null;
}

export interface PhoenixMemberKpi {
  memberId: string;
  name: string;
  role: string;
  gitlabHandle: string | null;
  capacityWeekly: number;
  rows: PhoenixMemberKpiMetricRow[];
}

export interface PhoenixMemberKpiReport {
  generatedAt: string;
  months: PhoenixMonthColumn[];
  members: PhoenixMemberKpi[];
}

export const PHOENIX_KPI_SHEET_NAME = "Phoenix";
export const DEFAULT_PHOENIX_KPI_SLUG = "phoenix-fy26";
export const PHOENIX_KPI_SOURCE_FILE =
  "FY26_KPI_TEAM_DEVELOPMENT_MASTER_SOURCE_PHOENIX.xlsx";
