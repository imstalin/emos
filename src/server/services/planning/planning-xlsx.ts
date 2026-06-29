import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

import type { PlanningCellValue, PlanningSheet } from "@/domain/types/planning";
import {
  PLANNING_SHEET_FY27,
  PLANNING_SHEET_PIVOT,
} from "@/domain/types/planning";

function normalizeCell(value: unknown): PlanningCellValue {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  return String(value);
}

function normalizeRow(row: unknown[]): PlanningCellValue[] {
  return row.map(normalizeCell);
}

export function parseWorkbookBuffer(buffer: Buffer): PlanningSheet[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet?.["!ref"]) {
      return { name, headers: [], rows: [] };
    }

    const data = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as unknown[][];

    const headerRow = data[0] ?? [];
    const headers = headerRow.map((cell) =>
      cell === null || cell === undefined ? "" : String(cell),
    );
    const rows = data.slice(1).map((row) => normalizeRow(row as unknown[]));

    return { name, headers, rows };
  });
}

function parseHours(value: PlanningCellValue): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Regenerate pivot summary from FY 27 Planning rows (quarter → title → hours). */
export function buildPivotSheet(fy27Sheet: PlanningSheet): PlanningSheet {
  const quarterIndex = fy27Sheet.headers.findIndex(
    (header) => header.toLowerCase() === "quarter",
  );
  const hoursIndex = fy27Sheet.headers.findIndex(
    (header) => header.toLowerCase() === "hours",
  );
  const titleIndex = fy27Sheet.headers.findIndex(
    (header) => header.toLowerCase() === "title",
  );

  if (quarterIndex < 0 || hoursIndex < 0 || titleIndex < 0) {
    return {
      name: PLANNING_SHEET_PIVOT,
      headers: ["Row Labels", "Sum of Hours"],
      rows: [],
    };
  }

  const grouped = new Map<string, Map<string, number>>();

  for (const row of fy27Sheet.rows) {
    const quarter = row[quarterIndex];
    const title = row[titleIndex];
    const hours = parseHours(row[hoursIndex]);
    if (!title || hours <= 0) continue;

    const quarterKey =
      typeof quarter === "string" || typeof quarter === "number"
        ? String(quarter).trim()
        : "Unassigned";
    const titleKey = String(title).trim();

    if (!grouped.has(quarterKey)) grouped.set(quarterKey, new Map());
    const titles = grouped.get(quarterKey)!;
    titles.set(titleKey, (titles.get(titleKey) ?? 0) + hours);
  }

  const rows: PlanningCellValue[][] = [];
  let grandTotal = 0;

  const quarterKeys = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  for (const quarterKey of quarterKeys) {
    const titles = grouped.get(quarterKey)!;
    const quarterTotal = [...titles.values()].reduce((sum, h) => sum + h, 0);
    grandTotal += quarterTotal;
    rows.push([quarterKey, quarterTotal]);

    const titleKeys = [...titles.keys()].sort((a, b) => a.localeCompare(b));
    for (const titleKey of titleKeys) {
      rows.push([titleKey, titles.get(titleKey)!]);
    }
  }

  rows.push(["Grand Total", grandTotal]);

  return {
    name: PLANNING_SHEET_PIVOT,
    headers: ["Row Labels", "Sum of Hours"],
    rows,
  };
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "4472C4" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "D9D9D9" } },
      left: { style: "thin", color: { argb: "D9D9D9" } },
      bottom: { style: "thin", color: { argb: "D9D9D9" } },
      right: { style: "thin", color: { argb: "D9D9D9" } },
    };
  });
}

function applyBodyCellStyle(cell: ExcelJS.Cell) {
  cell.alignment = { vertical: "top", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "E8E8E8" } },
    left: { style: "thin", color: { argb: "E8E8E8" } },
    bottom: { style: "thin", color: { argb: "E8E8E8" } },
    right: { style: "thin", color: { argb: "E8E8E8" } },
  };
}

export async function buildWorkbookBuffer(sheets: PlanningSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Engineering Manager OS";

  const sheetsForExport = [...sheets];
  const fy27 = sheets.find((sheet) => sheet.name === PLANNING_SHEET_FY27);
  if (fy27) {
    const pivot = buildPivotSheet(fy27);
    const pivotIndex = sheetsForExport.findIndex(
      (sheet) => sheet.name === PLANNING_SHEET_PIVOT,
    );
    if (pivotIndex >= 0) {
      sheetsForExport[pivotIndex] = pivot;
    } else {
      sheetsForExport.push(pivot);
    }
  }

  for (const sheet of sheetsForExport) {
    const worksheet = workbook.addWorksheet(sheet.name);
    const columnCount = Math.max(
      sheet.headers.length,
      sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
    );

    const headers =
      columnCount > sheet.headers.length
        ? [
            ...sheet.headers,
            ...Array.from({ length: columnCount - sheet.headers.length }, () => ""),
          ]
        : sheet.headers;

    const headerRow = worksheet.addRow(headers.map((header) => header ?? ""));
    applyHeaderStyle(headerRow);

    for (const row of sheet.rows) {
      const values = Array.from({ length: columnCount }, (_, index) => {
        const value = row[index];
        return value === null || value === undefined ? "" : value;
      });
      const dataRow = worksheet.addRow(values);
      dataRow.eachCell((cell) => applyBodyCellStyle(cell));
    }

    worksheet.columns.forEach((column, index) => {
      const headerLength = headers[index]?.length ?? 10;
      column.width = Math.min(48, Math.max(10, headerLength + 4));
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
