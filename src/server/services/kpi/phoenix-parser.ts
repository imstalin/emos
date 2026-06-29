import { format } from "date-fns";
import * as XLSX from "xlsx";

import type {
  PhoenixKpiDocument,
  PhoenixKpiMonthValue,
  PhoenixKpiRow,
  PhoenixMonthColumn,
} from "@/domain/types/phoenix-kpi";
import { PHOENIX_KPI_SHEET_NAME } from "@/domain/types/phoenix-kpi";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function toMonthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

function toMonthLabel(date: Date): string {
  return format(date, "MMM yyyy");
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseApplicable(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "yes";
}

function cellString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function parsePhoenixSheetFromWorkbook(
  workbook: XLSX.WorkBook,
  sheetName = PHOENIX_KPI_SHEET_NAME,
): PhoenixKpiDocument | null {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.["!ref"]) return null;

  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  if (data.length < 3) return null;

  const headerRow = data[0] ?? [];
  const months: PhoenixMonthColumn[] = [];

  for (let col = 9; col < headerRow.length; col += 2) {
    const date = parseDate(headerRow[col]);
    if (!date) continue;
    months.push({
      key: toMonthKey(date),
      label: toMonthLabel(date),
      endDate: date.toISOString(),
    });
  }

  const rows: PhoenixKpiRow[] = [];
  let currentCategory: string | null = null;

  for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex] ?? [];
    const kpi = cellString(row[1]);
    if (!kpi) continue;

    const categoryCell = cellString(row[0]);
    if (categoryCell) currentCategory = categoryCell;

    const monthly: PhoenixKpiMonthValue[] = months.map((month, index) => {
      const remarksCol = 9 + index * 2;
      const scoreCol = remarksCol + 1;
      return {
        monthKey: month.key,
        remarks: cellString(row[remarksCol]),
        score: parseNumber(row[scoreCol]),
        automated: false,
        evidence: null,
      };
    });

    rows.push({
      id: slugify(kpi),
      category: currentCategory,
      kpi,
      applicable: parseApplicable(row[2]),
      measure: cellString(row[3]),
      definitionRemarks: cellString(row[4]),
      unit: cellString(row[5]),
      benchmark: cellString(row[6]),
      targetScore: row[7] === null ? null : (row[7] as string | number),
      ytdScore: parseNumber(row[8]),
      monthly,
    });
  }

  return {
    team: "Phoenix",
    fiscalYear: "FY26",
    sheetName,
    months,
    rows,
  };
}

export function parsePhoenixSheetBuffer(buffer: Buffer): PhoenixKpiDocument | null {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return parsePhoenixSheetFromWorkbook(workbook);
}