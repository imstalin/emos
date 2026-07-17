-- Sprint Intelligence persistence (additive only).
-- Rollback guidance (manual):
--   DROP TABLE IF EXISTS "SprintManagedLabelOwnership";
--   DROP TABLE IF EXISTS "SprintLabelAction";
--   DROP TABLE IF EXISTS "SprintIssueEvaluation";
--   DROP TABLE IF EXISTS "SprintIntelligenceProjectConfig";
--   DROP TABLE IF EXISTS "SprintEvaluationRun";
--   DROP TYPE IF EXISTS "SprintLabelActionStatus";
--   DROP TYPE IF EXISTS "SprintLabelActionType";
--   DROP TYPE IF EXISTS "SprintEvaluationTrigger";
--   DROP TYPE IF EXISTS "SprintEvaluationRunStatus";
--   DROP TYPE IF EXISTS "SprintEvaluationRunMode";
-- Then remove the corresponding row from "_prisma_migrations".

-- CreateEnum
CREATE TYPE "SprintEvaluationRunMode" AS ENUM ('ANALYZE', 'APPLY');

-- CreateEnum
CREATE TYPE "SprintEvaluationRunStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'STALE', 'REJECTED');

-- CreateEnum
CREATE TYPE "SprintEvaluationTrigger" AS ENUM ('MANUAL', 'SCHEDULED_PERIODIC', 'SPRINT_START', 'DURING_SPRINT', 'SPRINT_END', 'RETRY', 'POST_SPRINT_RECONCILIATION');

-- CreateEnum
CREATE TYPE "SprintLabelActionType" AS ENUM ('ADD', 'REMOVE');

-- CreateEnum
CREATE TYPE "SprintLabelActionStatus" AS ENUM ('PLANNED', 'SKIPPED', 'APPLIED', 'FAILED', 'NO_OP', 'REJECTED');

-- CreateTable
CREATE TABLE "SprintEvaluationRun" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "mode" "SprintEvaluationRunMode" NOT NULL,
    "status" "SprintEvaluationRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggerType" "SprintEvaluationTrigger" NOT NULL DEFAULT 'MANUAL',
    "projectIds" INTEGER[],
    "milestoneId" INTEGER NOT NULL,
    "milestoneTitle" TEXT NOT NULL,
    "milestoneStartDate" TEXT,
    "milestoneDueDate" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "ruleConfigSnapshot" JSONB NOT NULL DEFAULT '{}',
    "inputHash" TEXT,
    "analysisHash" TEXT,
    "sourceAnalysisRunId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "jobId" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "automationVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintIssueEvaluation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "issueId" INTEGER NOT NULL,
    "issueIid" INTEGER NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "milestoneTitle" TEXT NOT NULL,
    "assignmentTimestamp" TIMESTAMP(3),
    "removalTimestamp" TIMESTAMP(3),
    "completionTimestamp" TIMESTAMP(3),
    "planningStatus" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "workTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedFromCommitment" BOOLEAN NOT NULL DEFAULT false,
    "completedWithinSprint" BOOLEAN NOT NULL DEFAULT false,
    "existingLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedLabelsToAdd" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedManagedLabelsToRemove" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventResolutionDetails" JSONB NOT NULL DEFAULT '{}',
    "evaluationErrorCode" TEXT,
    "evaluationErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintIssueEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintLabelAction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "issueEvaluationId" TEXT,
    "projectId" INTEGER NOT NULL,
    "issueIid" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "action" "SprintLabelActionType" NOT NULL,
    "status" "SprintLabelActionStatus" NOT NULL DEFAULT 'PLANNED',
    "ownedBefore" BOOLEAN NOT NULL DEFAULT false,
    "ownedAfter" BOOLEAN,
    "plannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "gitlabResponseStatus" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintLabelAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintManagedLabelOwnership" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "issueIid" INTEGER NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "ruleId" TEXT,
    "sourceRunId" TEXT,
    "sourceLabelActionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintManagedLabelOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintIntelligenceProjectConfig" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "enabled" BOOLEAN,
    "dryRunOnly" BOOLEAN,
    "timezone" TEXT,
    "allowFirstDayAdditions" BOOLEAN,
    "createMissingLabels" BOOLEAN,
    "removeInvalidManagedLabels" BOOLEAN,
    "supportExcludedFromCommitment" BOOLEAN,
    "hotfixExcludedFromCommitment" BOOLEAN,
    "uatExcludedFromCommitment" BOOLEAN,
    "allowTitleOnlyMilestoneMatch" BOOLEAN,
    "maxConcurrency" INTEGER,
    "maxPages" INTEGER,
    "maxAnalysisAgeMinutes" INTEGER,
    "scheduleEnabled" BOOLEAN,
    "duringSprintIntervalMinutes" INTEGER,
    "ruleConfigOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintIntelligenceProjectConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SprintEvaluationRun_runKey_key" ON "SprintEvaluationRun"("runKey");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_status_idx" ON "SprintEvaluationRun"("status");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_mode_idx" ON "SprintEvaluationRun"("mode");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_milestoneId_idx" ON "SprintEvaluationRun"("milestoneId");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_createdAt_idx" ON "SprintEvaluationRun"("createdAt");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_jobId_idx" ON "SprintEvaluationRun"("jobId");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_sourceAnalysisRunId_idx" ON "SprintEvaluationRun"("sourceAnalysisRunId");

-- CreateIndex
CREATE INDEX "SprintEvaluationRun_triggerType_milestoneId_status_idx" ON "SprintEvaluationRun"("triggerType", "milestoneId", "status");

-- CreateIndex
CREATE INDEX "SprintIssueEvaluation_runId_idx" ON "SprintIssueEvaluation"("runId");

-- CreateIndex
CREATE INDEX "SprintIssueEvaluation_projectId_issueIid_idx" ON "SprintIssueEvaluation"("projectId", "issueIid");

-- CreateIndex
CREATE INDEX "SprintIssueEvaluation_milestoneId_idx" ON "SprintIssueEvaluation"("milestoneId");

-- CreateIndex
CREATE INDEX "SprintIssueEvaluation_planningStatus_idx" ON "SprintIssueEvaluation"("planningStatus");

-- CreateIndex
CREATE INDEX "SprintIssueEvaluation_deliveryStatus_idx" ON "SprintIssueEvaluation"("deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SprintIssueEvaluation_runId_projectId_issueIid_key" ON "SprintIssueEvaluation"("runId", "projectId", "issueIid");

-- CreateIndex
CREATE INDEX "SprintLabelAction_runId_idx" ON "SprintLabelAction"("runId");

-- CreateIndex
CREATE INDEX "SprintLabelAction_projectId_issueIid_idx" ON "SprintLabelAction"("projectId", "issueIid");

-- CreateIndex
CREATE INDEX "SprintLabelAction_status_idx" ON "SprintLabelAction"("status");

-- CreateIndex
CREATE INDEX "SprintLabelAction_issueEvaluationId_idx" ON "SprintLabelAction"("issueEvaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintManagedLabelOwnership_sourceLabelActionId_key" ON "SprintManagedLabelOwnership"("sourceLabelActionId");

-- CreateIndex
CREATE INDEX "SprintManagedLabelOwnership_projectId_issueIid_idx" ON "SprintManagedLabelOwnership"("projectId", "issueIid");

-- CreateIndex
CREATE INDEX "SprintManagedLabelOwnership_milestoneId_idx" ON "SprintManagedLabelOwnership"("milestoneId");

-- CreateIndex
CREATE INDEX "SprintManagedLabelOwnership_label_idx" ON "SprintManagedLabelOwnership"("label");

-- CreateIndex
CREATE INDEX "SprintManagedLabelOwnership_isActive_idx" ON "SprintManagedLabelOwnership"("isActive");

-- CreateIndex
CREATE INDEX "SprintManagedLabelOwnership_projectId_issueIid_label_isActi_idx" ON "SprintManagedLabelOwnership"("projectId", "issueIid", "label", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SprintManagedLabelOwnership_projectId_issueIid_milestoneId__key" ON "SprintManagedLabelOwnership"("projectId", "issueIid", "milestoneId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "SprintIntelligenceProjectConfig_projectId_key" ON "SprintIntelligenceProjectConfig"("projectId");

-- CreateIndex
CREATE INDEX "SprintIntelligenceProjectConfig_projectId_idx" ON "SprintIntelligenceProjectConfig"("projectId");

-- CreateIndex
CREATE INDEX "SprintIntelligenceProjectConfig_enabled_idx" ON "SprintIntelligenceProjectConfig"("enabled");

-- AddForeignKey
ALTER TABLE "SprintEvaluationRun" ADD CONSTRAINT "SprintEvaluationRun_sourceAnalysisRunId_fkey" FOREIGN KEY ("sourceAnalysisRunId") REFERENCES "SprintEvaluationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintIssueEvaluation" ADD CONSTRAINT "SprintIssueEvaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SprintEvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintLabelAction" ADD CONSTRAINT "SprintLabelAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SprintEvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintLabelAction" ADD CONSTRAINT "SprintLabelAction_issueEvaluationId_fkey" FOREIGN KEY ("issueEvaluationId") REFERENCES "SprintIssueEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintManagedLabelOwnership" ADD CONSTRAINT "SprintManagedLabelOwnership_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "SprintEvaluationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintManagedLabelOwnership" ADD CONSTRAINT "SprintManagedLabelOwnership_sourceLabelActionId_fkey" FOREIGN KEY ("sourceLabelActionId") REFERENCES "SprintLabelAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

