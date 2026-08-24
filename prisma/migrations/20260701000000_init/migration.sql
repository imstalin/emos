-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('DEVELOPER', 'QA', 'MANAGER');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('ISSUE', 'MERGE_REQUEST', 'EPIC');

-- CreateEnum
CREATE TYPE "WorkItemState" AS ENUM ('OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'BLOCKED', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'AT_RISK', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('GITLAB_API', 'DOM_EXTRACTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReleaseStream" AS ENUM ('PRODUCT', 'OBSERVATIONS', 'MOBILE');

-- CreateEnum
CREATE TYPE "Connect3030Status" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'DEVELOPER',
    "gitlabUserId" INTEGER,
    "gitlabHandle" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitLabProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gitlabId" INTEGER,
    "gitlabPath" TEXT,
    "description" TEXT,
    "webUrl" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitLabProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWorkflow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowColumn" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT,
    "wipLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "projectId" TEXT,
    "gitlabMilestoneId" INTEGER,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseEpic" (
    "id" TEXT NOT NULL,
    "gitlabGroupId" INTEGER NOT NULL,
    "epicIid" INTEGER NOT NULL,
    "workItemId" INTEGER,
    "title" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "stream" "ReleaseStream" NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'opened',
    "webUrl" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseEpic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "columnId" TEXT,
    "assigneeId" TEXT,
    "reviewerId" TEXT,
    "type" "WorkItemType" NOT NULL,
    "state" "WorkItemState" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "health" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "gitlabIid" INTEGER,
    "gitlabId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "milestoneId" INTEGER,
    "milestoneTitle" TEXT,
    "storyPoints" INTEGER,
    "dueDate" TIMESTAMP(3),
    "blockedReason" TEXT,
    "reviewStatus" TEXT,
    "qaStatus" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "parentEpicIid" INTEGER,
    "timeSpentSeconds" INTEGER,
    "timeEstimateSeconds" INTEGER,
    "qaOwnerId" TEXT,
    "syncSource" "SyncSource" NOT NULL DEFAULT 'MANUAL',
    "webUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitLabActionAudit" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "targetIid" INTEGER NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitLabActionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "sheets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL DEFAULT 'FY27 V1',
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSheetDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "sheetData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiSheetDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connect3030Session" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" "Connect3030Status" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "autoBrief" JSONB NOT NULL DEFAULT '{}',
    "responses" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connect3030Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_email_key" ON "TeamMember"("teamId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "GitLabProject_slug_key" ON "GitLabProject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GitLabProject_gitlabId_key" ON "GitLabProject"("gitlabId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkflow_projectId_key" ON "ProjectWorkflow"("projectId");

-- CreateIndex
CREATE INDEX "WorkflowColumn_workflowId_idx" ON "WorkflowColumn"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowColumn_workflowId_slug_key" ON "WorkflowColumn"("workflowId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_gitlabMilestoneId_key" ON "Sprint"("gitlabMilestoneId");

-- CreateIndex
CREATE INDEX "Sprint_teamId_idx" ON "Sprint"("teamId");

-- CreateIndex
CREATE INDEX "Sprint_projectId_idx" ON "Sprint"("projectId");

-- CreateIndex
CREATE INDEX "Release_projectId_idx" ON "Release"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_projectId_version_key" ON "Release"("projectId", "version");

-- CreateIndex
CREATE INDEX "ReleaseEpic_monthKey_idx" ON "ReleaseEpic"("monthKey");

-- CreateIndex
CREATE INDEX "ReleaseEpic_state_idx" ON "ReleaseEpic"("state");

-- CreateIndex
CREATE INDEX "ReleaseEpic_stream_idx" ON "ReleaseEpic"("stream");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseEpic_gitlabGroupId_epicIid_key" ON "ReleaseEpic"("gitlabGroupId", "epicIid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_gitlabId_key" ON "WorkItem"("gitlabId");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_idx" ON "WorkItem"("projectId");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_idx" ON "WorkItem"("assigneeId");

-- CreateIndex
CREATE INDEX "WorkItem_qaOwnerId_idx" ON "WorkItem"("qaOwnerId");

-- CreateIndex
CREATE INDEX "WorkItem_state_idx" ON "WorkItem"("state");

-- CreateIndex
CREATE INDEX "WorkItem_priority_idx" ON "WorkItem"("priority");

-- CreateIndex
CREATE INDEX "WorkItem_parentEpicIid_idx" ON "WorkItem"("parentEpicIid");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceRule_slug_key" ON "GovernanceRule"("slug");

-- CreateIndex
CREATE INDEX "SyncRun_source_entityType_idx" ON "SyncRun"("source", "entityType");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "GitLabActionAudit_createdAt_idx" ON "GitLabActionAudit"("createdAt");

-- CreateIndex
CREATE INDEX "GitLabActionAudit_projectId_targetIid_idx" ON "GitLabActionAudit"("projectId", "targetIid");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDocument_slug_key" ON "PlanningDocument"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapDocument_slug_key" ON "RoadmapDocument"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSheetDocument_slug_key" ON "KpiSheetDocument"("slug");

-- CreateIndex
CREATE INDEX "Connect3030Session_monthKey_idx" ON "Connect3030Session"("monthKey");

-- CreateIndex
CREATE INDEX "Connect3030Session_memberId_idx" ON "Connect3030Session"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Connect3030Session_memberId_monthKey_key" ON "Connect3030Session"("memberId", "monthKey");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkflow" ADD CONSTRAINT "ProjectWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitLabProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowColumn" ADD CONSTRAINT "WorkflowColumn_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ProjectWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitLabProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitLabProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitLabProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "WorkflowColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_qaOwnerId_fkey" FOREIGN KEY ("qaOwnerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connect3030Session" ADD CONSTRAINT "Connect3030Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

