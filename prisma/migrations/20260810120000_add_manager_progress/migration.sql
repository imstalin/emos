-- CreateEnum
CREATE TYPE "ProgressAlignment" AS ENUM ('ALIGNED', 'SUPPORTING', 'UNPLANNED', 'UNKNOWN');
CREATE TYPE "WorkClassification" AS ENUM ('PLANNED_FEATURE', 'ENHANCEMENT', 'DEFECT', 'HOTFIX', 'PRODUCTION_SUPPORT', 'TECHNICAL_MAINTENANCE', 'UNPLANNED', 'UNKNOWN');
CREATE TYPE "CorrelationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "ProgressMovement" AS ENUM ('MEANINGFUL_PROGRESS', 'ACTIVE_NO_MOVEMENT', 'BLOCKED', 'SLIPPING', 'COMPLETED');
CREATE TYPE "BlockerCategory" AS ENUM ('TECHNICAL', 'QA', 'ENVIRONMENT', 'PRODUCT_DECISION', 'EXTERNAL_TEAM', 'REVIEW', 'RELEASE', 'INFRASTRUCTURE', 'UNKNOWN');
CREATE TYPE "ManagerAttentionSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "GitLabMemberFeed" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "feedEnvKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastEventId" TEXT,
    "lastHttpStatus" INTEGER,
    "lastError" TEXT,
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitLabMemberFeed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitLabFeedActivity" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "gitlabEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "project" TEXT,
    "repository" TEXT,
    "branch" TEXT,
    "commitSha" TEXT,
    "mrNumber" INTEGER,
    "issueNumber" INTEGER,
    "pipelineId" INTEGER,
    "environment" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitLabFeedActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EngineeringPriority" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "teamId" TEXT,
    "ownerId" TEXT,
    "priorityOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "targetDate" TIMESTAMP(3),
    "releaseDate" TIMESTAMP(3),
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectMappings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineeringPriority_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressWorkItem" (
    "id" TEXT NOT NULL,
    "externalReference" TEXT,
    "title" TEXT NOT NULL,
    "project" TEXT,
    "ownerId" TEXT,
    "teamId" TEXT,
    "priorityId" TEXT,
    "classification" "WorkClassification" NOT NULL DEFAULT 'UNKNOWN',
    "alignment" "ProgressAlignment" NOT NULL DEFAULT 'UNKNOWN',
    "stage" TEXT NOT NULL DEFAULT 'backlog',
    "status" TEXT NOT NULL DEFAULT 'active',
    "targetDate" TIMESTAMP(3),
    "lastMeaningfulProgressAt" TIMESTAMP(3),
    "correlationConfidence" "CorrelationConfidence" NOT NULL DEFAULT 'LOW',
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressWorkItemActivity" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressWorkItemActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressSnapshot" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "previousStage" TEXT,
    "currentStage" TEXT NOT NULL,
    "movement" "ProgressMovement" NOT NULL DEFAULT 'ACTIVE_NO_MOVEMENT',
    "summary" TEXT,
    "blocker" TEXT,
    "risk" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressBlocker" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "category" "BlockerCategory" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "sourceActivityId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressBlocker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerAttentionItem" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT,
    "priorityId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ManagerAttentionSeverity" NOT NULL DEFAULT 'WARNING',
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "snapshotDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerAttentionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerOverride" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "authorId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerProgressConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerProgressConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitLabMemberFeed_memberId_key" ON "GitLabMemberFeed"("memberId");
CREATE INDEX "GitLabMemberFeed_isEnabled_idx" ON "GitLabMemberFeed"("isEnabled");
CREATE UNIQUE INDEX "GitLabFeedActivity_gitlabEventId_key" ON "GitLabFeedActivity"("gitlabEventId");
CREATE INDEX "GitLabFeedActivity_memberId_timestamp_idx" ON "GitLabFeedActivity"("memberId", "timestamp");
CREATE INDEX "GitLabFeedActivity_feedId_idx" ON "GitLabFeedActivity"("feedId");
CREATE INDEX "GitLabFeedActivity_eventType_idx" ON "GitLabFeedActivity"("eventType");
CREATE INDEX "GitLabFeedActivity_timestamp_idx" ON "GitLabFeedActivity"("timestamp");
CREATE INDEX "GitLabFeedActivity_mrNumber_idx" ON "GitLabFeedActivity"("mrNumber");
CREATE INDEX "GitLabFeedActivity_issueNumber_idx" ON "GitLabFeedActivity"("issueNumber");
CREATE INDEX "EngineeringPriority_teamId_idx" ON "EngineeringPriority"("teamId");
CREATE INDEX "EngineeringPriority_status_idx" ON "EngineeringPriority"("status");
CREATE INDEX "EngineeringPriority_priorityOrder_idx" ON "EngineeringPriority"("priorityOrder");
CREATE INDEX "ProgressWorkItem_ownerId_idx" ON "ProgressWorkItem"("ownerId");
CREATE INDEX "ProgressWorkItem_teamId_idx" ON "ProgressWorkItem"("teamId");
CREATE INDEX "ProgressWorkItem_priorityId_idx" ON "ProgressWorkItem"("priorityId");
CREATE INDEX "ProgressWorkItem_stage_idx" ON "ProgressWorkItem"("stage");
CREATE INDEX "ProgressWorkItem_status_idx" ON "ProgressWorkItem"("status");
CREATE INDEX "ProgressWorkItem_externalReference_idx" ON "ProgressWorkItem"("externalReference");
CREATE INDEX "ProgressWorkItem_lastMeaningfulProgressAt_idx" ON "ProgressWorkItem"("lastMeaningfulProgressAt");
CREATE UNIQUE INDEX "ProgressWorkItemActivity_workItemId_activityId_key" ON "ProgressWorkItemActivity"("workItemId", "activityId");
CREATE INDEX "ProgressWorkItemActivity_workItemId_idx" ON "ProgressWorkItemActivity"("workItemId");
CREATE INDEX "ProgressWorkItemActivity_activityId_idx" ON "ProgressWorkItemActivity"("activityId");
CREATE UNIQUE INDEX "ProgressSnapshot_workItemId_snapshotDate_key" ON "ProgressSnapshot"("workItemId", "snapshotDate");
CREATE INDEX "ProgressSnapshot_snapshotDate_idx" ON "ProgressSnapshot"("snapshotDate");
CREATE INDEX "ProgressSnapshot_movement_idx" ON "ProgressSnapshot"("movement");
CREATE INDEX "ProgressBlocker_workItemId_idx" ON "ProgressBlocker"("workItemId");
CREATE INDEX "ProgressBlocker_isResolved_idx" ON "ProgressBlocker"("isResolved");
CREATE INDEX "ManagerAttentionItem_snapshotDate_idx" ON "ManagerAttentionItem"("snapshotDate");
CREATE INDEX "ManagerAttentionItem_severity_idx" ON "ManagerAttentionItem"("severity");
CREATE INDEX "ManagerAttentionItem_isDismissed_idx" ON "ManagerAttentionItem"("isDismissed");
CREATE INDEX "ManagerOverride_workItemId_idx" ON "ManagerOverride"("workItemId");
CREATE INDEX "ManagerOverride_field_idx" ON "ManagerOverride"("field");

-- AddForeignKey
ALTER TABLE "GitLabMemberFeed" ADD CONSTRAINT "GitLabMemberFeed_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitLabFeedActivity" ADD CONSTRAINT "GitLabFeedActivity_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "GitLabMemberFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitLabFeedActivity" ADD CONSTRAINT "GitLabFeedActivity_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngineeringPriority" ADD CONSTRAINT "EngineeringPriority_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EngineeringPriority" ADD CONSTRAINT "EngineeringPriority_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressWorkItem" ADD CONSTRAINT "ProgressWorkItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressWorkItem" ADD CONSTRAINT "ProgressWorkItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressWorkItem" ADD CONSTRAINT "ProgressWorkItem_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "EngineeringPriority"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressWorkItemActivity" ADD CONSTRAINT "ProgressWorkItemActivity_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProgressWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressWorkItemActivity" ADD CONSTRAINT "ProgressWorkItemActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "GitLabFeedActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressSnapshot" ADD CONSTRAINT "ProgressSnapshot_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProgressWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressBlocker" ADD CONSTRAINT "ProgressBlocker_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProgressWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerAttentionItem" ADD CONSTRAINT "ManagerAttentionItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProgressWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerOverride" ADD CONSTRAINT "ManagerOverride_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProgressWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerOverride" ADD CONSTRAINT "ManagerOverride_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
