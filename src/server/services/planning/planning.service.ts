import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";

import type {
  PlanningDocumentData,
  PlanningSheet,
  PlanningSummary,
} from "@/domain/types/planning";
import {
  DEFAULT_PLANNING_SLUG,
  PLANNING_SHEET_FY27,
} from "@/domain/types/planning";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";

import {
  buildWorkbookBuffer,
  parseWorkbookBuffer,
} from "./planning-xlsx";

const DEFAULT_FILE_PATH = path.join(
  process.cwd(),
  "plan",
  "FY 27 Draft Planning.xlsx",
);

function parseHours(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function findColumnIndex(headers: string[], name: string): number {
  return headers.findIndex(
    (header) => header.toLowerCase() === name.toLowerCase(),
  );
}

function sheetsFromJson(value: Prisma.JsonValue): PlanningSheet[] {
  if (!Array.isArray(value)) return [];
  return value as PlanningSheet[];
}

function toDocumentData(record: {
  id: string;
  slug: string;
  name: string;
  fiscalYear: string;
  sheets: Prisma.JsonValue;
  updatedAt: Date;
}): PlanningDocumentData {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    fiscalYear: record.fiscalYear,
    sheets: sheetsFromJson(record.sheets),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function loadDefaultFromFile(): Promise<PlanningSheet[]> {
  try {
    const buffer = await readFile(DEFAULT_FILE_PATH);
    return parseWorkbookBuffer(buffer);
  } catch (error) {
    logger.warn("Default planning file unavailable", { error });
    return [];
  }
}

export const planningService = {
  async getDocument(slug = DEFAULT_PLANNING_SLUG): Promise<PlanningDocumentData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      const sheets = await loadDefaultFromFile();
      return {
        id: "demo",
        slug,
        name: "FY 27 Draft Planning",
        fiscalYear: "FY27",
        sheets,
        updatedAt: new Date().toISOString(),
      };
    }

    const existing = await db.planningDocument.findUnique({ where: { slug } });
    if (existing) {
      return toDocumentData(existing);
    }

    const sheets = await loadDefaultFromFile();
    const created = await db.planningDocument.create({
      data: {
        slug,
        name: "FY 27 Draft Planning",
        fiscalYear: "FY27",
        sheets: sheets as unknown as Prisma.InputJsonValue,
      },
    });

    return toDocumentData(created);
  },

  async updateSheet(
    slug: string,
    sheetName: string,
    rows: PlanningSheet["rows"],
  ): Promise<PlanningDocumentData> {
    const document = await this.getDocument(slug);
    const sheets = document.sheets.map((sheet) =>
      sheet.name === sheetName ? { ...sheet, rows } : sheet,
    );

    if (!sheets.some((sheet) => sheet.name === sheetName)) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const connected = await checkDatabaseConnection();
    if (!connected || document.id === "demo") {
      return { ...document, sheets, updatedAt: new Date().toISOString() };
    }

    const updated = await db.planningDocument.update({
      where: { slug },
      data: { sheets: sheets as unknown as Prisma.InputJsonValue },
    });

    return toDocumentData(updated);
  },

  async importWorkbook(
    slug: string,
    buffer: Buffer,
  ): Promise<PlanningDocumentData> {
    const sheets = parseWorkbookBuffer(buffer);
    const connected = await checkDatabaseConnection();

    if (!connected) {
      return {
        id: "demo",
        slug,
        name: "FY 27 Draft Planning",
        fiscalYear: "FY27",
        sheets,
        updatedAt: new Date().toISOString(),
      };
    }

    const updated = await db.planningDocument.upsert({
      where: { slug },
      create: {
        slug,
        name: "FY 27 Draft Planning",
        fiscalYear: "FY27",
        sheets: sheets as unknown as Prisma.InputJsonValue,
      },
      update: { sheets: sheets as unknown as Prisma.InputJsonValue },
    });

    return toDocumentData(updated);
  },

  async exportWorkbook(slug = DEFAULT_PLANNING_SLUG): Promise<Buffer> {
    const document = await this.getDocument(slug);
    return buildWorkbookBuffer(document.sheets);
  },

  buildSummary(document: PlanningDocumentData): PlanningSummary {
    const fy27 = document.sheets.find((sheet) => sheet.name === PLANNING_SHEET_FY27);
    if (!fy27) {
      return {
        totalItems: 0,
        totalHours: 0,
        byQuarter: [],
        byProject: [],
        byInclude: [],
      };
    }

    const priorityIdx = findColumnIndex(fy27.headers, "Priority");
    const includeIdx = findColumnIndex(fy27.headers, "Include");
    const projectIdx = findColumnIndex(fy27.headers, "Project");
    const quarterIdx = findColumnIndex(fy27.headers, "Quarter");
    const hoursIdx = findColumnIndex(fy27.headers, "Hours");
    const titleIdx = findColumnIndex(fy27.headers, "Title");

    const byQuarter = new Map<string, { hours: number; count: number }>();
    const byProject = new Map<string, { hours: number; count: number }>();
    const byInclude = new Map<string, number>();

    let totalHours = 0;
    let totalItems = 0;

    for (const row of fy27.rows) {
      const title = row[titleIdx];
      if (!title) continue;

      totalItems += 1;
      const hours = parseHours(row[hoursIdx]);
      totalHours += hours;

      const quarter =
        row[quarterIdx] === null || row[quarterIdx] === undefined
          ? "Unassigned"
          : String(row[quarterIdx]);
      const project =
        row[projectIdx] === null || row[projectIdx] === undefined
          ? "Unassigned"
          : String(row[projectIdx]);
      const include =
        row[includeIdx] === null || row[includeIdx] === undefined
          ? "Unset"
          : String(row[includeIdx]);

      const quarterRow = byQuarter.get(quarter) ?? { hours: 0, count: 0 };
      quarterRow.hours += hours;
      quarterRow.count += 1;
      byQuarter.set(quarter, quarterRow);

      const projectRow = byProject.get(project) ?? { hours: 0, count: 0 };
      projectRow.hours += hours;
      projectRow.count += 1;
      byProject.set(project, projectRow);

      byInclude.set(include, (byInclude.get(include) ?? 0) + 1);

      void priorityIdx;
    }

    const toSortedHours = (
      entries: Array<[string, { hours: number; count: number }]>,
    ) =>
      entries
        .sort((a, b) => b[1].hours - a[1].hours)
        .map(([key, value]) => ({
          key,
          hours: value.hours,
          count: value.count,
        }));

    return {
      totalItems,
      totalHours,
      byQuarter: toSortedHours([...byQuarter.entries()]).map((row) => ({
        quarter: row.key,
        hours: row.hours,
        count: row.count,
      })),
      byProject: toSortedHours([...byProject.entries()]).map((row) => ({
        project: row.key,
        hours: row.hours,
        count: row.count,
      })),
      byInclude: [...byInclude.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([include, count]) => ({ include, count })),
    };
  },
};
