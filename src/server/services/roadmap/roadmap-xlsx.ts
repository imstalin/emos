import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PlanningSheet } from "@/domain/types/planning";
import {
  DEFAULT_ROADMAP_SLUG,
  ROADMAP_SHEET_FY27_V1,
  type RoadmapItem,
} from "@/domain/types/roadmap";
import {
  normalizeInclude,
  normalizePriority,
  parseBooleanFlag,
  parseRoadmapHours,
} from "@/features/roadmap/lib/roadmap-utils";
import { parseWorkbookBuffer } from "@/server/services/planning/planning-xlsx";

export const ROADMAP_WORKBOOK_PATH = path.join(
  process.cwd(),
  "plan",
  "FY 27 Draft Planning.xlsx",
);

function findColumnIndex(headers: string[], name: string): number {
  return headers.findIndex(
    (header) => header?.trim().toLowerCase() === name.toLowerCase(),
  );
}

function inferTimeline(quarter: string, timeline: unknown): string {
  const explicit = timeline === null || timeline === undefined ? "" : String(timeline).trim();
  if (explicit) return explicit;
  if (!quarter || quarter.toUpperCase() === "TBD") return "TBD";
  return `${quarter} FY27`;
}

function mapSheetRowToItem(
  row: Array<string | number | boolean | null>,
  headers: string[],
  index: number,
): RoadmapItem | null {
  const titleIdx = findColumnIndex(headers, "Title");
  const title = row[titleIdx];
  if (!title) return null;

  const priorityIdx = findColumnIndex(headers, "Priority");
  const includeIdx = findColumnIndex(headers, "Include");
  const projectIdx = findColumnIndex(headers, "Project");
  const categoryIdx = findColumnIndex(headers, "Category");
  const quarterIdx = findColumnIndex(headers, "Quarter");
  const timelineIdx = findColumnIndex(headers, "Timeline");
  const assigneeIdx = findColumnIndex(headers, "Assignee");
  const hoursIdx = findColumnIndex(headers, "Hours");
  const coreIdx = findColumnIndex(headers, "Core");
  const mobIdx = findColumnIndex(headers, "Mob");
  const dataIdx = findColumnIndex(headers, "Data");
  const descriptionIdx = findColumnIndex(headers, "Description");

  const quarter = String(row[quarterIdx] ?? "TBD");

  return {
    id: `${DEFAULT_ROADMAP_SLUG}-${index + 1}`,
    priority: normalizePriority(row[priorityIdx]),
    include: normalizeInclude(row[includeIdx]),
    project: String(row[projectIdx] ?? "Unassigned"),
    category: String(row[categoryIdx] ?? "Enhancement"),
    quarter,
    timeline: inferTimeline(quarter, row[timelineIdx]),
    assignee: String(row[assigneeIdx] ?? "").trim(),
    hours: parseRoadmapHours(row[hoursIdx]),
    core: parseBooleanFlag(row[coreIdx]),
    mobile: parseBooleanFlag(row[mobIdx]),
    data: parseBooleanFlag(row[dataIdx]),
    title: String(title),
    description: String(row[descriptionIdx] ?? ""),
  };
}

export function parseFy27V1Sheet(sheet: PlanningSheet): RoadmapItem[] {
  return sheet.rows
    .map((row, index) => mapSheetRowToItem(row, sheet.headers, index))
    .filter((item): item is RoadmapItem => item !== null);
}

export async function loadFy27V1ItemsFromWorkbook(
  filePath = ROADMAP_WORKBOOK_PATH,
): Promise<RoadmapItem[]> {
  const buffer = await readFile(filePath);
  const sheets = parseWorkbookBuffer(buffer);
  const sheet = sheets.find((entry) => entry.name === ROADMAP_SHEET_FY27_V1);

  if (!sheet) {
    throw new Error(`Sheet not found: ${ROADMAP_SHEET_FY27_V1}`);
  }

  return parseFy27V1Sheet(sheet);
}
