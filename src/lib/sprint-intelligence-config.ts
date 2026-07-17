import { z } from "zod";

import { DEFAULT_SPRINT_INTELLIGENCE_CONFIG } from "@/domain/sprint-intelligence";
import type { SprintIntelligenceRuleConfig } from "@/domain/types/sprint-intelligence";

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  });

const sprintIntelligenceEnvSchema = z.object({
  enabled: boolFromEnv.default(false),
  dryRunOnly: boolFromEnv.default(true),
  discoveryEnabled: boolFromEnv.default(false),
  discoveryIntervalMinutes: z.coerce.number().int().positive().default(15),
  duringSprintIntervalMinutes: z.coerce.number().int().positive().default(60),
  postSprintReconciliationHours: z.coerce.number().int().nonnegative().default(24),
  workerConcurrency: z.coerce.number().int().positive().default(2),
  jobAttempts: z.coerce.number().int().positive().default(3),
  jobBackoffMs: z.coerce.number().int().positive().default(5_000),
  maxAnalysisAgeMinutes: z.coerce.number().int().positive().default(15),
  createMissingLabels: boolFromEnv.default(false),
  autoApply: boolFromEnv.default(false),
  timezone: z.string().default("Asia/Kolkata"),
  allowFirstDayAdditions: boolFromEnv.default(true),
  supportExcludedFromCommitment: boolFromEnv.default(true),
  hotfixExcludedFromCommitment: boolFromEnv.default(true),
  uatExcludedFromCommitment: boolFromEnv.default(false),
  maxConcurrency: z.coerce.number().int().positive().default(5),
  maxPages: z.coerce.number().int().positive().optional(),
});

export type SprintIntelligenceEnvConfig = z.infer<
  typeof sprintIntelligenceEnvSchema
>;

export const SPRINT_INTELLIGENCE_AUTOMATION_VERSION = "1.0.0";

export const SPRINT_INTELLIGENCE_QUEUE_NAME = "sprint-intelligence";
export const SPRINT_INTELLIGENCE_ANALYZE_JOB = "sprint-intelligence.analyze";
export const SPRINT_INTELLIGENCE_APPLY_JOB = "sprint-intelligence.apply";
export const SPRINT_INTELLIGENCE_DISCOVER_JOB = "sprint-intelligence.discover";
export const SPRINT_INTELLIGENCE_RECONCILE_JOB =
  "sprint-intelligence.reconcile-ownership";
export const SPRINT_INTELLIGENCE_DISCOVERY_SCHEDULER_ID =
  "sprint-intelligence-discovery-scheduler";

export type SprintIntelligenceProjectOverride = {
  projectId: number;
  enabled?: boolean | null;
  dryRunOnly?: boolean | null;
  timezone?: string | null;
  allowFirstDayAdditions?: boolean | null;
  createMissingLabels?: boolean | null;
  removeInvalidManagedLabels?: boolean | null;
  supportExcludedFromCommitment?: boolean | null;
  hotfixExcludedFromCommitment?: boolean | null;
  uatExcludedFromCommitment?: boolean | null;
  allowTitleOnlyMilestoneMatch?: boolean | null;
  maxConcurrency?: number | null;
  maxPages?: number | null;
  maxAnalysisAgeMinutes?: number | null;
  scheduleEnabled?: boolean | null;
  duringSprintIntervalMinutes?: number | null;
  ruleConfigOverrides?: Partial<SprintIntelligenceRuleConfig> | null;
};

export type EffectiveSprintIntelligenceConfig = {
  enabled: boolean;
  dryRunOnly: boolean;
  discoveryEnabled: boolean;
  discoveryIntervalMinutes: number;
  duringSprintIntervalMinutes: number;
  postSprintReconciliationHours: number;
  workerConcurrency: number;
  jobAttempts: number;
  jobBackoffMs: number;
  maxAnalysisAgeMinutes: number;
  createMissingLabels: boolean;
  autoApply: boolean;
  scheduleEnabled: boolean;
  allowTitleOnlyMilestoneMatch: boolean;
  removeInvalidManagedLabels: boolean;
  maxConcurrency: number;
  maxPages?: number;
  ruleConfig: SprintIntelligenceRuleConfig;
};

export function getSprintIntelligenceEnvConfig(): SprintIntelligenceEnvConfig {
  return sprintIntelligenceEnvSchema.parse({
    enabled: process.env.SPRINT_INTELLIGENCE_ENABLED,
    dryRunOnly: process.env.SPRINT_INTELLIGENCE_DRY_RUN_ONLY,
    discoveryEnabled: process.env.SPRINT_INTELLIGENCE_DISCOVERY_ENABLED,
    discoveryIntervalMinutes:
      process.env.SPRINT_INTELLIGENCE_DISCOVERY_INTERVAL_MINUTES,
    duringSprintIntervalMinutes:
      process.env.SPRINT_INTELLIGENCE_DURING_SPRINT_INTERVAL_MINUTES,
    postSprintReconciliationHours:
      process.env.SPRINT_INTELLIGENCE_POST_SPRINT_RECONCILIATION_HOURS,
    workerConcurrency: process.env.SPRINT_INTELLIGENCE_WORKER_CONCURRENCY,
    jobAttempts: process.env.SPRINT_INTELLIGENCE_JOB_ATTEMPTS,
    jobBackoffMs: process.env.SPRINT_INTELLIGENCE_JOB_BACKOFF_MS,
    maxAnalysisAgeMinutes:
      process.env.SPRINT_INTELLIGENCE_MAX_ANALYSIS_AGE_MINUTES,
    createMissingLabels: process.env.SPRINT_INTELLIGENCE_CREATE_MISSING_LABELS,
    autoApply: process.env.SPRINT_INTELLIGENCE_AUTO_APPLY,
    timezone: process.env.SPRINT_TIMEZONE,
    allowFirstDayAdditions: process.env.ALLOW_FIRST_DAY_ADDITIONS,
    supportExcludedFromCommitment:
      process.env.SPRINT_INTELLIGENCE_SUPPORT_EXCLUDED,
    hotfixExcludedFromCommitment:
      process.env.SPRINT_INTELLIGENCE_HOTFIX_EXCLUDED,
    uatExcludedFromCommitment: process.env.SPRINT_INTELLIGENCE_UAT_EXCLUDED,
    maxConcurrency: process.env.SPRINT_INTELLIGENCE_MAX_CONCURRENCY,
    maxPages: process.env.SPRINT_INTELLIGENCE_MAX_PAGES,
  });
}

/**
 * Resolve effective config:
 * Project DB override → Environment defaults → Domain defaults
 */
export function resolveEffectiveSprintIntelligenceConfig(
  projectOverride?: SprintIntelligenceProjectOverride | null,
  envConfig: SprintIntelligenceEnvConfig = getSprintIntelligenceEnvConfig(),
): EffectiveSprintIntelligenceConfig {
  const ruleConfig: SprintIntelligenceRuleConfig = {
    ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG,
    timezone: envConfig.timezone,
    allowFirstDayAdditions: envConfig.allowFirstDayAdditions,
    supportExcludedFromCommitment: envConfig.supportExcludedFromCommitment,
    hotfixExcludedFromCommitment: envConfig.hotfixExcludedFromCommitment,
    uatExcludedFromCommitment: envConfig.uatExcludedFromCommitment,
    managedLabels: { ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels },
    workTypeAliases: { ...DEFAULT_SPRINT_INTELLIGENCE_CONFIG.workTypeAliases },
    completionStates: [...DEFAULT_SPRINT_INTELLIGENCE_CONFIG.completionStates],
    ...(projectOverride?.ruleConfigOverrides ?? {}),
  };

  if (projectOverride?.timezone) ruleConfig.timezone = projectOverride.timezone;
  if (projectOverride?.allowFirstDayAdditions != null) {
    ruleConfig.allowFirstDayAdditions = projectOverride.allowFirstDayAdditions;
  }
  if (projectOverride?.supportExcludedFromCommitment != null) {
    ruleConfig.supportExcludedFromCommitment =
      projectOverride.supportExcludedFromCommitment;
  }
  if (projectOverride?.hotfixExcludedFromCommitment != null) {
    ruleConfig.hotfixExcludedFromCommitment =
      projectOverride.hotfixExcludedFromCommitment;
  }
  if (projectOverride?.uatExcludedFromCommitment != null) {
    ruleConfig.uatExcludedFromCommitment =
      projectOverride.uatExcludedFromCommitment;
  }

  return {
    enabled: projectOverride?.enabled ?? envConfig.enabled,
    dryRunOnly: projectOverride?.dryRunOnly ?? envConfig.dryRunOnly,
    discoveryEnabled: envConfig.discoveryEnabled,
    discoveryIntervalMinutes: envConfig.discoveryIntervalMinutes,
    duringSprintIntervalMinutes:
      projectOverride?.duringSprintIntervalMinutes ??
      envConfig.duringSprintIntervalMinutes,
    postSprintReconciliationHours: envConfig.postSprintReconciliationHours,
    workerConcurrency: envConfig.workerConcurrency,
    jobAttempts: envConfig.jobAttempts,
    jobBackoffMs: envConfig.jobBackoffMs,
    maxAnalysisAgeMinutes:
      projectOverride?.maxAnalysisAgeMinutes ?? envConfig.maxAnalysisAgeMinutes,
    createMissingLabels:
      projectOverride?.createMissingLabels ?? envConfig.createMissingLabels,
    autoApply: envConfig.autoApply,
    scheduleEnabled: projectOverride?.scheduleEnabled ?? true,
    allowTitleOnlyMilestoneMatch:
      projectOverride?.allowTitleOnlyMilestoneMatch ?? false,
    removeInvalidManagedLabels:
      projectOverride?.removeInvalidManagedLabels ?? true,
    maxConcurrency:
      projectOverride?.maxConcurrency ?? envConfig.maxConcurrency,
    maxPages: projectOverride?.maxPages ?? envConfig.maxPages,
    ruleConfig,
  };
}
