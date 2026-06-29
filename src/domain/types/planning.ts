export type PlanningCellValue = string | number | boolean | null;

export interface PlanningSheet {
  name: string;
  headers: string[];
  rows: PlanningCellValue[][];
}

export interface PlanningDocumentData {
  id: string;
  slug: string;
  name: string;
  fiscalYear: string;
  sheets: PlanningSheet[];
  updatedAt: string;
}

export interface PlanningSummary {
  totalItems: number;
  totalHours: number;
  byQuarter: Array<{ quarter: string; hours: number; count: number }>;
  byProject: Array<{ project: string; hours: number; count: number }>;
  byInclude: Array<{ include: string; count: number }>;
}

export const PLANNING_SHEET_FY27 = "FY 27 Planning";
export const PLANNING_SHEET_FY26 = "FY 26 Current";
export const PLANNING_SHEET_PIVOT = "Pivote";

export const DEFAULT_PLANNING_SLUG = "fy27-draft";
