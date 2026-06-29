import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";

import type {
  PhoenixAutomateResult,
  PhoenixKpiData,
  PhoenixKpiDocument,
  PhoenixMemberKpiReport,
} from "@/domain/types/phoenix-kpi";
import {
  DEFAULT_PHOENIX_KPI_SLUG,
  PHOENIX_KPI_SOURCE_FILE,
} from "@/domain/types/phoenix-kpi";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";

import {
  automatePhoenixDocument,
  buildDemoAutomatedDocument,
} from "./phoenix-calculator";
import { parsePhoenixSheetBuffer } from "./phoenix-parser";
import { buildPhoenixWorkbookBuffer } from "./phoenix-xlsx";
import { buildPhoenixMemberReport } from "./phoenix-member-calculator";

const DEFAULT_FILE_PATH = path.join(
  process.cwd(),
  "plan",
  PHOENIX_KPI_SOURCE_FILE,
);

function documentFromJson(value: Prisma.JsonValue): PhoenixKpiDocument {
  return value as PhoenixKpiDocument;
}

function toKpiData(record: {
  id: string;
  slug: string;
  team: string;
  fiscalYear: string;
  sheetData: Prisma.JsonValue;
  updatedAt: Date;
}): PhoenixKpiData {
  return {
    id: record.id,
    slug: record.slug,
    team: record.team,
    fiscalYear: record.fiscalYear,
    document: documentFromJson(record.sheetData),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function loadDefaultFromFile(): Promise<PhoenixKpiDocument | null> {
  try {
    const buffer = await readFile(DEFAULT_FILE_PATH);
    return parsePhoenixSheetBuffer(buffer);
  } catch (error) {
    logger.warn("Default Phoenix KPI file unavailable", { error });
    return null;
  }
}

export const phoenixKpiService = {
  async getData(slug = DEFAULT_PHOENIX_KPI_SLUG): Promise<PhoenixKpiData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      const document = await loadDefaultFromFile();
      if (!document) {
        throw new Error("Phoenix KPI template file not found");
      }
      return {
        id: "demo",
        slug,
        team: document.team,
        fiscalYear: document.fiscalYear,
        document,
        updatedAt: new Date().toISOString(),
      };
    }

    const existing = await db.kpiSheetDocument.findUnique({ where: { slug } });
    if (existing) {
      return toKpiData(existing);
    }

    const document = await loadDefaultFromFile();
    if (!document) {
      throw new Error("Phoenix KPI template file not found");
    }

    const created = await db.kpiSheetDocument.create({
      data: {
        slug,
        team: document.team,
        fiscalYear: document.fiscalYear,
        sheetData: document as unknown as Prisma.InputJsonValue,
      },
    });

    return toKpiData(created);
  },

  async saveDocument(
    slug: string,
    document: PhoenixKpiDocument,
  ): Promise<PhoenixKpiData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      return {
        id: "demo",
        slug,
        team: document.team,
        fiscalYear: document.fiscalYear,
        document,
        updatedAt: new Date().toISOString(),
      };
    }

    const updated = await db.kpiSheetDocument.update({
      where: { slug },
      data: { sheetData: document as unknown as Prisma.InputJsonValue },
    });

    return toKpiData(updated);
  },

  async importWorkbook(slug: string, buffer: Buffer): Promise<PhoenixKpiData> {
    const document = parsePhoenixSheetBuffer(buffer);
    if (!document) {
      throw new Error("Phoenix sheet not found in workbook");
    }

    const connected = await checkDatabaseConnection();
    if (!connected) {
      return {
        id: "demo",
        slug,
        team: document.team,
        fiscalYear: document.fiscalYear,
        document,
        updatedAt: new Date().toISOString(),
      };
    }

    const updated = await db.kpiSheetDocument.upsert({
      where: { slug },
      create: {
        slug,
        team: document.team,
        fiscalYear: document.fiscalYear,
        sheetData: document as unknown as Prisma.InputJsonValue,
      },
      update: { sheetData: document as unknown as Prisma.InputJsonValue },
    });

    return toKpiData(updated);
  },

  async exportWorkbook(slug = DEFAULT_PHOENIX_KPI_SLUG): Promise<Buffer> {
    const data = await this.getData(slug);
    return buildPhoenixWorkbookBuffer(data.document);
  },

  async getMemberReport(slug = DEFAULT_PHOENIX_KPI_SLUG): Promise<PhoenixMemberKpiReport> {
    const data = await this.getData(slug);
    const connected = await checkDatabaseConnection();
    if (!connected) {
      return {
        generatedAt: new Date().toISOString(),
        months: data.document.months,
        members: [],
      };
    }
    return buildPhoenixMemberReport(data.document);
  },

  async automate(slug = DEFAULT_PHOENIX_KPI_SLUG): Promise<PhoenixAutomateResult> {
    const current = await this.getData(slug);
    const connected = await checkDatabaseConnection();
    const workItemCount =
      connected ? await db.workItem.count() : 0;

    let result: PhoenixAutomateResult;
    if (!connected || workItemCount === 0) {
      const document = buildDemoAutomatedDocument(current.document);
      result = {
        document,
        updatedKpis: document.rows
          .filter((row) => row.applicable)
          .map((row) => row.kpi),
        skippedKpis: document.rows
          .filter((row) => !row.applicable)
          .map((row) => row.kpi),
      };
    } else {
      const automated = await automatePhoenixDocument(current.document);
      result = {
        document: automated.document,
        updatedKpis: automated.updatedKpis,
        skippedKpis: automated.skippedKpis,
      };
    }

    if (connected && current.id !== "demo") {
      await db.kpiSheetDocument.update({
        where: { slug },
        data: {
          sheetData: result.document as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return result;
  },
};
