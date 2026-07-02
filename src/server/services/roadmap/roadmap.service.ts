import type { Prisma } from "@prisma/client";

import {
  DEFAULT_ROADMAP_SLUG,
  ROADMAP_SHEET_FY27_V1,
  type RoadmapData,
  type RoadmapItem,
} from "@/domain/types/roadmap";
import { buildRoadmapSummary } from "@/features/roadmap/lib/roadmap-utils";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";

import { loadFy27V1ItemsFromWorkbook } from "./roadmap-xlsx";

const DOCUMENT_NAME = "FY27 Roadmap V1";

let memoryDocument: RoadmapData | null = null;

function itemsFromJson(value: Prisma.JsonValue): RoadmapItem[] {
  if (!Array.isArray(value)) return [];
  return value as RoadmapItem[];
}

function toRoadmapData(record: {
  slug: string;
  sourceSheet: string;
  items: Prisma.JsonValue;
  updatedAt: Date;
}): RoadmapData {
  const items = itemsFromJson(record.items);
  return {
    slug: record.slug,
    sourceSheet: record.sourceSheet,
    items,
    summary: buildRoadmapSummary(items),
    generatedAt: record.updatedAt.toISOString(),
  };
}

async function loadSeedItems(): Promise<RoadmapItem[]> {
  try {
    return await loadFy27V1ItemsFromWorkbook();
  } catch (error) {
    logger.warn("FY27 V1 workbook unavailable, using empty roadmap seed", { error });
    return [];
  }
}

async function buildSeedDocument(): Promise<RoadmapData> {
  const items = await loadSeedItems();
  return {
    slug: DEFAULT_ROADMAP_SLUG,
    sourceSheet: ROADMAP_SHEET_FY27_V1,
    items,
    summary: buildRoadmapSummary(items),
    generatedAt: new Date().toISOString(),
  };
}

async function getMemoryDocument(): Promise<RoadmapData> {
  if (!memoryDocument) {
    memoryDocument = await buildSeedDocument();
  }
  return memoryDocument;
}

function setMemoryDocument(items: RoadmapItem[]) {
  memoryDocument = {
    slug: DEFAULT_ROADMAP_SLUG,
    sourceSheet: ROADMAP_SHEET_FY27_V1,
    items,
    summary: buildRoadmapSummary(items),
    generatedAt: new Date().toISOString(),
  };
  return memoryDocument;
}

export class RoadmapService {
  async getData(slug = DEFAULT_ROADMAP_SLUG): Promise<RoadmapData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      logger.info("Using in-memory roadmap — database unavailable");
      return getMemoryDocument();
    }

    try {
      const existing = await db.roadmapDocument.findUnique({ where: { slug } });
      if (existing) {
        return toRoadmapData(existing);
      }

      const items = await loadSeedItems();
      const created = await db.roadmapDocument.create({
        data: {
          slug,
          name: DOCUMENT_NAME,
          fiscalYear: "FY27",
          sourceSheet: ROADMAP_SHEET_FY27_V1,
          items: items as unknown as Prisma.InputJsonValue,
        },
      });

      return toRoadmapData(created);
    } catch (error) {
      logger.warn("Roadmap database unavailable, using in-memory store", { error });
      return getMemoryDocument();
    }
  }

  async createItem(
    input: Omit<RoadmapItem, "id">,
    slug = DEFAULT_ROADMAP_SLUG,
  ): Promise<RoadmapData> {
    const item: RoadmapItem = {
      ...input,
      id: crypto.randomUUID(),
    };

    const connected = await checkDatabaseConnection();
    if (!connected) {
      const current = await getMemoryDocument();
      return setMemoryDocument([item, ...current.items]);
    }

    try {
      const document = await this.getData(slug);
      const items = [item, ...document.items];

      const updated = await db.roadmapDocument.update({
        where: { slug },
        data: { items: items as unknown as Prisma.InputJsonValue },
      });

      return toRoadmapData(updated);
    } catch (error) {
      logger.warn("Roadmap create fell back to in-memory store", { error });
      const current = await getMemoryDocument();
      return setMemoryDocument([item, ...current.items]);
    }
  }

  async updateItem(
    id: string,
    input: Omit<RoadmapItem, "id">,
    slug = DEFAULT_ROADMAP_SLUG,
  ): Promise<RoadmapData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      const current = await getMemoryDocument();
      const items = current.items.map((entry) =>
        entry.id === id ? { ...input, id } : entry,
      );
      if (!items.some((entry) => entry.id === id)) {
        throw new Error(`Roadmap item not found: ${id}`);
      }
      return setMemoryDocument(items);
    }

    try {
      const document = await this.getData(slug);
      const items = document.items.map((entry) =>
        entry.id === id ? { ...input, id } : entry,
      );

      if (!items.some((entry) => entry.id === id)) {
        throw new Error(`Roadmap item not found: ${id}`);
      }

      const updated = await db.roadmapDocument.update({
        where: { slug },
        data: { items: items as unknown as Prisma.InputJsonValue },
      });

      return toRoadmapData(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      logger.warn("Roadmap update fell back to in-memory store", { error });
      const current = await getMemoryDocument();
      const items = current.items.map((entry) =>
        entry.id === id ? { ...input, id } : entry,
      );
      if (!items.some((entry) => entry.id === id)) {
        throw new Error(`Roadmap item not found: ${id}`);
      }
      return setMemoryDocument(items);
    }
  }

  async deleteItem(id: string, slug = DEFAULT_ROADMAP_SLUG): Promise<RoadmapData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      const current = await getMemoryDocument();
      const items = current.items.filter((entry) => entry.id !== id);
      if (items.length === current.items.length) {
        throw new Error(`Roadmap item not found: ${id}`);
      }
      return setMemoryDocument(items);
    }

    try {
      const document = await this.getData(slug);
      const items = document.items.filter((entry) => entry.id !== id);

      if (items.length === document.items.length) {
        throw new Error(`Roadmap item not found: ${id}`);
      }

      const updated = await db.roadmapDocument.update({
        where: { slug },
        data: { items: items as unknown as Prisma.InputJsonValue },
      });

      return toRoadmapData(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      logger.warn("Roadmap delete fell back to in-memory store", { error });
      const current = await getMemoryDocument();
      const items = current.items.filter((entry) => entry.id !== id);
      if (items.length === current.items.length) {
        throw new Error(`Roadmap item not found: ${id}`);
      }
      return setMemoryDocument(items);
    }
  }

  async replaceItems(items: RoadmapItem[], slug = DEFAULT_ROADMAP_SLUG): Promise<RoadmapData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      return setMemoryDocument(items);
    }

    try {
      const updated = await db.roadmapDocument.update({
        where: { slug },
        data: { items: items as unknown as Prisma.InputJsonValue },
      });
      return toRoadmapData(updated);
    } catch (error) {
      logger.warn("Roadmap replaceItems fell back to in-memory store", { error });
      return setMemoryDocument(items);
    }
  }

  async reimportFromWorkbook(slug = DEFAULT_ROADMAP_SLUG): Promise<RoadmapData> {
    const items = await loadSeedItems();

    const connected = await checkDatabaseConnection();
    if (!connected) {
      return setMemoryDocument(items);
    }

    try {
      const updated = await db.roadmapDocument.upsert({
        where: { slug },
        create: {
          slug,
          name: DOCUMENT_NAME,
          fiscalYear: "FY27",
          sourceSheet: ROADMAP_SHEET_FY27_V1,
          items: items as unknown as Prisma.InputJsonValue,
        },
        update: {
          sourceSheet: ROADMAP_SHEET_FY27_V1,
          items: items as unknown as Prisma.InputJsonValue,
        },
      });

      return toRoadmapData(updated);
    } catch (error) {
      logger.warn("Roadmap import fell back to in-memory store", { error });
      return setMemoryDocument(items);
    }
  }
}

export const roadmapService = new RoadmapService();
