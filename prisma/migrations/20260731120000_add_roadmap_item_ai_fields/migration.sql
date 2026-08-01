-- AI-ready title/description for GitLab issue creation.
-- Planning columns remain `title` / `description`; GitLab create prefers `ai_*`.

ALTER TABLE "RoadmapItem"
ADD COLUMN "ai_title" TEXT NOT NULL DEFAULT '',
ADD COLUMN "ai_description" TEXT NOT NULL DEFAULT '';
