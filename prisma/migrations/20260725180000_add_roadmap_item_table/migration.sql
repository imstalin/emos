-- Roadmap items as first-class rows (title + description columns).
-- Legacy RoadmapDocument.items JSON is retained and mapped as itemsJson in Prisma;
-- the app migrates JSON → rows on first read, then clears the blob.
--
-- Rollback guidance (manual):
--   DROP TABLE IF EXISTS "RoadmapItem";
--   Then remove the corresponding row from "_prisma_migrations".

CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "include" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "timeline" TEXT NOT NULL DEFAULT '',
    "assignee" TEXT NOT NULL DEFAULT '',
    "hours" JSONB NOT NULL,
    "core" BOOLEAN NOT NULL DEFAULT false,
    "mobile" BOOLEAN NOT NULL DEFAULT false,
    "data" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "gitlab" JSONB,
    "hoursSpent" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoadmapItem_documentId_idx" ON "RoadmapItem"("documentId");

CREATE INDEX "RoadmapItem_documentId_position_idx" ON "RoadmapItem"("documentId", "position");

ALTER TABLE "RoadmapItem"
ADD CONSTRAINT "RoadmapItem_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "RoadmapDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
