import type { Prisma, RoadmapItem as DbRoadmapItem } from "@prisma/client";

import {
  DEFAULT_ROADMAP_SLUG,
  ROADMAP_SHEET_FY27_V1,
  type RoadmapData,
  type RoadmapGitLabLink,
  type RoadmapHours,
  type RoadmapItem,
} from "@/domain/types/roadmap";
import { buildRoadmapSummary } from "@/features/roadmap/lib/roadmap-utils";
import { checkDatabaseConnection, db } from "@/lib/db";
import { logger } from "@/lib/logger";

import { loadFy27V1ItemsFromWorkbook } from "./roadmap-xlsx";

const DOCUMENT_NAME = "FY27 Roadmap V1";

let memoryDocument: RoadmapData | null = null;

function parseHours(value: Prisma.JsonValue): RoadmapHours {
  if (value === "TBD") return "TBD";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().toUpperCase() === "TBD") return "TBD";
  const asNumber = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(asNumber) ? asNumber : "TBD";
}

function parseGitLab(value: Prisma.JsonValue | null | undefined): RoadmapGitLabLink | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.projectId !== "number" ||
    typeof record.issueIid !== "number" ||
    typeof record.issueUrl !== "string" ||
    typeof record.issueId !== "number"
  ) {
    return undefined;
  }
  return {
    projectId: record.projectId,
    issueIid: record.issueIid,
    issueUrl: record.issueUrl,
    issueId: record.issueId,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
  };
}

function rowToItem(row: DbRoadmapItem): RoadmapItem {
  return {
    id: row.id,
    priority: row.priority as RoadmapItem["priority"],
    include: row.include as RoadmapItem["include"],
    project: row.project,
    category: row.category,
    quarter: row.quarter,
    timeline: row.timeline,
    assignee: row.assignee,
    hours: parseHours(row.hours),
    core: row.core,
    mobile: row.mobile,
    data: row.data,
    title: row.title,
    description: row.description,
    aiTitle: row.aiTitle,
    aiDescription: row.aiDescription,
    gitlab: parseGitLab(row.gitlab),
    hoursSpent: row.hoursSpent ?? undefined,
  };
}

function itemsFromLegacyJson(value: Prisma.JsonValue): RoadmapItem[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown as RoadmapItem[]).map((item) => ({
    ...item,
    aiTitle: item.aiTitle ?? "",
    aiDescription: item.aiDescription ?? "",
  }));
}

function itemFieldData(item: RoadmapItem, position: number) {
  return {
    id: item.id || crypto.randomUUID(),
    priority: item.priority,
    include: item.include,
    project: item.project,
    category: item.category,
    quarter: item.quarter,
    timeline: item.timeline,
    assignee: item.assignee,
    hours: item.hours as unknown as Prisma.InputJsonValue,
    core: item.core,
    mobile: item.mobile,
    data: item.data,
    title: item.title,
    description: item.description,
    aiTitle: item.aiTitle ?? "",
    aiDescription: item.aiDescription ?? "",
    gitlab: (item.gitlab ?? null) as unknown as Prisma.InputJsonValue,
    hoursSpent: item.hoursSpent ?? null,
    position,
  };
}

function itemCreateData(item: RoadmapItem, documentId: string, position: number) {
  return {
    ...itemFieldData(item, position),
    documentId,
  };
}

function toRoadmapData(args: {
  slug: string;
  sourceSheet: string;
  items: RoadmapItem[];
  updatedAt: Date;
}): RoadmapData {
  return {
    slug: args.slug,
    sourceSheet: args.sourceSheet,
    items: args.items,
    summary: buildRoadmapSummary(args.items),
    generatedAt: args.updatedAt.toISOString(),
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

async function ensureDocument(slug: string) {
  const existing = await db.roadmapDocument.findUnique({
    where: { slug },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (existing) return existing;

  const seedItems = await loadSeedItems();
  const created = await db.roadmapDocument.create({
    data: {
      slug,
      name: DOCUMENT_NAME,
      fiscalYear: "FY27",
      sourceSheet: ROADMAP_SHEET_FY27_V1,
      itemsJson: [],
      items: {
        create: seedItems.map((item, index) => itemFieldData(item, index)),
      },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  return created;
}

async function migrateLegacyJsonIfNeeded(
  document: Awaited<ReturnType<typeof ensureDocument>>,
): Promise<Awaited<ReturnType<typeof ensureDocument>>> {
  if (document.items.length > 0) {
    return document;
  }

  const legacy = itemsFromLegacyJson(document.itemsJson);
  if (legacy.length === 0) {
    return document;
  }

  logger.info("Migrating roadmap JSON items into RoadmapItem rows", {
    slug: document.slug,
    count: legacy.length,
  });

  await db.$transaction([
    db.roadmapItem.createMany({
      data: legacy.map((item, index) =>
        itemCreateData(
          { ...item, id: item.id || crypto.randomUUID() },
          document.id,
          index,
        ),
      ),
    }),
    db.roadmapDocument.update({
      where: { id: document.id },
      data: { itemsJson: [] },
    }),
  ]);

  return db.roadmapDocument.findUniqueOrThrow({
    where: { id: document.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
}

async function loadDocument(slug: string) {
  const document = await ensureDocument(slug);
  return migrateLegacyJsonIfNeeded(document);
}

function touchDocument(documentId: string) {
  return db.roadmapDocument.update({
    where: { id: documentId },
    data: { updatedAt: new Date() },
  });
}

export class RoadmapService {
  async getData(slug = DEFAULT_ROADMAP_SLUG): Promise<RoadmapData> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      logger.info("Using in-memory roadmap — database unavailable");
      return getMemoryDocument();
    }

    try {
      const document = await loadDocument(slug);
      return toRoadmapData({
        slug: document.slug,
        sourceSheet: document.sourceSheet,
        items: document.items.map(rowToItem),
        updatedAt: document.updatedAt,
      });
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
      const document = await loadDocument(slug);
      await db.$transaction([
        db.roadmapItem.updateMany({
          where: { documentId: document.id },
          data: { position: { increment: 1 } },
        }),
        db.roadmapItem.create({
          data: itemCreateData(item, document.id, 0),
        }),
        touchDocument(document.id),
      ]);

      return this.getData(slug);
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
      const document = await loadDocument(slug);
      const existing = document.items.find((entry) => entry.id === id);
      if (!existing) {
        throw new Error(`Roadmap item not found: ${id}`);
      }

      await db.$transaction([
        db.roadmapItem.update({
          where: { id },
          data: {
            priority: input.priority,
            include: input.include,
            project: input.project,
            category: input.category,
            quarter: input.quarter,
            timeline: input.timeline,
            assignee: input.assignee,
            hours: input.hours as unknown as Prisma.InputJsonValue,
            core: input.core,
            mobile: input.mobile,
            data: input.data,
            title: input.title,
            description: input.description,
            aiTitle: input.aiTitle ?? "",
            aiDescription: input.aiDescription ?? "",
            gitlab: (input.gitlab ?? null) as unknown as Prisma.InputJsonValue,
            hoursSpent: input.hoursSpent ?? null,
          },
        }),
        touchDocument(document.id),
      ]);

      return this.getData(slug);
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
      const document = await loadDocument(slug);
      if (!document.items.some((entry) => entry.id === id)) {
        throw new Error(`Roadmap item not found: ${id}`);
      }

      await db.$transaction([
        db.roadmapItem.delete({ where: { id } }),
        touchDocument(document.id),
      ]);

      return this.getData(slug);
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
      const document = await loadDocument(slug);

      await db.$transaction([
        db.roadmapItem.deleteMany({ where: { documentId: document.id } }),
        db.roadmapItem.createMany({
          data: items.map((item, index) =>
            itemCreateData(
              { ...item, id: item.id || crypto.randomUUID() },
              document.id,
              index,
            ),
          ),
        }),
        db.roadmapDocument.update({
          where: { id: document.id },
          data: {
            itemsJson: [],
            sourceSheet: ROADMAP_SHEET_FY27_V1,
            updatedAt: new Date(),
          },
        }),
      ]);

      return this.getData(slug);
    } catch (error) {
      logger.warn("Roadmap replaceItems fell back to in-memory store", { error });
      return setMemoryDocument(items);
    }
  }

  async reimportFromWorkbook(slug = DEFAULT_ROADMAP_SLUG): Promise<RoadmapData> {
    const items = await loadSeedItems();
    return this.replaceItems(items, slug);
  }
}

export const roadmapService = new RoadmapService();
