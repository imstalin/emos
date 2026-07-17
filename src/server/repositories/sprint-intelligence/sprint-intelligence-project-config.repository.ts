import type { SprintIntelligenceProjectConfig } from "@prisma/client";

import { db } from "@/lib/db";
import type { SprintIntelligenceProjectOverride } from "@/lib/sprint-intelligence-config";
import type { SprintIntelligenceRuleConfig } from "@/domain/types/sprint-intelligence";

export class SprintIntelligenceProjectConfigRepository {
  async getByProjectId(
    projectId: number,
  ): Promise<SprintIntelligenceProjectConfig | null> {
    return db.sprintIntelligenceProjectConfig.findUnique({
      where: { projectId },
    });
  }

  async listEnabledScheduleProjects(): Promise<SprintIntelligenceProjectConfig[]> {
    return db.sprintIntelligenceProjectConfig.findMany({
      where: {
        OR: [{ enabled: true }, { enabled: null }],
        NOT: { scheduleEnabled: false },
      },
    });
  }

  toOverride(
    row: SprintIntelligenceProjectConfig | null,
  ): SprintIntelligenceProjectOverride | null {
    if (!row) return null;
    return {
      projectId: row.projectId,
      enabled: row.enabled,
      dryRunOnly: row.dryRunOnly,
      timezone: row.timezone,
      allowFirstDayAdditions: row.allowFirstDayAdditions,
      createMissingLabels: row.createMissingLabels,
      removeInvalidManagedLabels: row.removeInvalidManagedLabels,
      supportExcludedFromCommitment: row.supportExcludedFromCommitment,
      hotfixExcludedFromCommitment: row.hotfixExcludedFromCommitment,
      uatExcludedFromCommitment: row.uatExcludedFromCommitment,
      allowTitleOnlyMilestoneMatch: row.allowTitleOnlyMilestoneMatch,
      maxConcurrency: row.maxConcurrency,
      maxPages: row.maxPages,
      maxAnalysisAgeMinutes: row.maxAnalysisAgeMinutes,
      scheduleEnabled: row.scheduleEnabled,
      duringSprintIntervalMinutes: row.duringSprintIntervalMinutes,
      ruleConfigOverrides: row.ruleConfigOverrides as
        | Partial<SprintIntelligenceRuleConfig>
        | null,
    };
  }
}

export const sprintIntelligenceProjectConfigRepository =
  new SprintIntelligenceProjectConfigRepository();
