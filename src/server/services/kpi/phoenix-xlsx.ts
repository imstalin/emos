import ExcelJS from "exceljs";

import type { PhoenixKpiDocument } from "@/domain/types/phoenix-kpi";
import { PHOENIX_KPI_SHEET_NAME } from "@/domain/types/phoenix-kpi";

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

export async function buildPhoenixWorkbookBuffer(
  document: PhoenixKpiDocument,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Engineering Manager OS";
  const worksheet = workbook.addWorksheet(PHOENIX_KPI_SHEET_NAME);

  const headerRow1: (string | Date | null)[] = [
    "Category",
    "KPI",
    "Applicable",
    "Measure",
    "Remarks",
    "Unit",
    "Benchmark",
    "Target Score",
    "YTD",
  ];

  for (const month of document.months) {
    headerRow1.push(new Date(month.endDate), null);
  }

  const headerRow2: (string | null)[] = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "YTD",
    ...document.months.flatMap(() => ["Remarks", "Score"]),
  ];

  const row1 = worksheet.addRow(headerRow1);
  applyHeaderStyle(row1);
  const row2 = worksheet.addRow(headerRow2);
  applyHeaderStyle(row2);

  let previousCategory: string | null = null;

  for (const kpiRow of document.rows) {
    const category =
      kpiRow.category && kpiRow.category !== previousCategory
        ? kpiRow.category
        : null;
    if (kpiRow.category) previousCategory = kpiRow.category;

    const values: (string | number | null)[] = [
      category,
      kpiRow.kpi,
      kpiRow.applicable ? "Yes" : "No",
      kpiRow.measure,
      kpiRow.definitionRemarks,
      kpiRow.unit,
      kpiRow.benchmark,
      kpiRow.targetScore,
      kpiRow.ytdScore,
    ];

    for (const month of kpiRow.monthly) {
      values.push(month.remarks, month.score);
    }

    const dataRow = worksheet.addRow(values);
    dataRow.eachCell((cell) => applyBodyCellStyle(cell));
  }

  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  worksheet.columns.forEach((column, index) => {
    column.width = index < 8 ? 18 : 14;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
