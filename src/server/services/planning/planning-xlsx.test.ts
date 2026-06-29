import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PLANNING_SHEET_FY27 } from "@/domain/types/planning";

import {
  buildPivotSheet,
  buildWorkbookBuffer,
  parseWorkbookBuffer,
} from "./planning-xlsx";

const SAMPLE_FILE = path.join(
  process.cwd(),
  "plan",
  "FY 27 Draft Planning.xlsx",
);

describe("planning-xlsx", () => {
  it("parses the FY27 draft workbook with all sheets", async () => {
    const buffer = await readFile(SAMPLE_FILE);
    const sheets = parseWorkbookBuffer(buffer);

    expect(sheets.length).toBe(3);
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "FY 26 Current",
      "FY 27 Planning",
      "Pivote",
    ]);

    const fy27 = sheets.find((sheet) => sheet.name === PLANNING_SHEET_FY27);
    expect(fy27?.headers).toContain("Title");
    expect(fy27?.rows.length).toBeGreaterThan(50);
  });

  it("builds pivot hours from FY27 rows", async () => {
    const buffer = await readFile(SAMPLE_FILE);
    const sheets = parseWorkbookBuffer(buffer);
    const fy27 = sheets.find((sheet) => sheet.name === PLANNING_SHEET_FY27)!;
    const pivot = buildPivotSheet(fy27);

    expect(pivot.headers).toEqual(["Row Labels", "Sum of Hours"]);
    expect(pivot.rows.at(-1)?.[0]).toBe("Grand Total");
    expect(Number(pivot.rows.at(-1)?.[1])).toBeGreaterThan(0);
  });

  it("exports a valid workbook buffer", async () => {
    const buffer = await readFile(SAMPLE_FILE);
    const sheets = parseWorkbookBuffer(buffer);
    const exported = await buildWorkbookBuffer(sheets);

    expect(exported.byteLength).toBeGreaterThan(1000);
    const roundTrip = parseWorkbookBuffer(exported);
    expect(roundTrip.map((sheet) => sheet.name)).toContain(PLANNING_SHEET_FY27);
  });
});
