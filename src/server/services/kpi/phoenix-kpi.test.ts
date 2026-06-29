import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PHOENIX_KPI_SHEET_NAME } from "@/domain/types/phoenix-kpi";

import { parsePhoenixSheetBuffer } from "./phoenix-parser";
import { buildPhoenixWorkbookBuffer } from "./phoenix-xlsx";

const SAMPLE_FILE = path.join(
  process.cwd(),
  "plan",
  "FY26_KPI_TEAM_DEVELOPMENT_MASTER_SOURCE_PHOENIX.xlsx",
);

describe("phoenix-kpi xlsx", () => {
  it("parses Phoenix sheet from master workbook", async () => {
    const buffer = await readFile(SAMPLE_FILE);
    const document = parsePhoenixSheetBuffer(buffer);

    expect(document).not.toBeNull();
    expect(document!.sheetName).toBe(PHOENIX_KPI_SHEET_NAME);
    expect(document!.rows.length).toBeGreaterThan(10);
    expect(document!.months.length).toBe(12);
    expect(document!.rows.some((row) => row.kpi.includes("Schedule"))).toBe(
      true,
    );
  });

  it("exports Phoenix workbook round-trip", async () => {
    const buffer = await readFile(SAMPLE_FILE);
    const document = parsePhoenixSheetBuffer(buffer)!;
    const exported = await buildPhoenixWorkbookBuffer(document);
    const roundTrip = parsePhoenixSheetBuffer(exported);

    expect(roundTrip?.rows.length).toBe(document.rows.length);
    expect(roundTrip?.months.length).toBe(document.months.length);
  });
});
