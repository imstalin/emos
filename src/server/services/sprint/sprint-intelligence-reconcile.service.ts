import { logger } from "@/lib/logger";
import { mapPool } from "@/lib/map-pool";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { managedOutcomeLabelSet } from "@/domain/sprint-intelligence";
import { DEFAULT_SPRINT_INTELLIGENCE_CONFIG } from "@/domain/sprint-intelligence";
import { db } from "@/lib/db";
import { sprintManagedLabelOwnershipRepository } from "@/server/repositories/sprint-intelligence/sprint-managed-label-ownership.repository";

export type OwnershipReconcileResult = {
  verified: number;
  released: number;
  missingFromGitLab: number;
  unownedManagedLabels: Array<{
    projectId: number;
    issueIid: number;
    label: string;
  }>;
  failed: Array<{
    projectId: number;
    issueIid?: number;
    message: string;
  }>;
};

/**
 * Report-only ownership reconciliation. Performs no GitLab writes.
 */
export class SprintIntelligenceReconcileService {
  constructor(private readonly gitlab: GitLabProvider) {}

  async reconcile(options?: {
    projectId?: number;
    maxConcurrency?: number;
  }): Promise<OwnershipReconcileResult> {
    const managed = managedOutcomeLabelSet(
      DEFAULT_SPRINT_INTELLIGENCE_CONFIG.managedLabels,
    );

    const ownershipRows = await db.sprintManagedLabelOwnership.findMany({
      where: {
        isActive: true,
        ...(options?.projectId != null
          ? { projectId: options.projectId }
          : {}),
      },
    });

    const result: OwnershipReconcileResult = {
      verified: 0,
      released: 0,
      missingFromGitLab: 0,
      unownedManagedLabels: [],
      failed: [],
    };

    const byIssue = new Map<string, typeof ownershipRows>();
    for (const row of ownershipRows) {
      const key = `${row.projectId}:${row.issueIid}`;
      const list = byIssue.get(key) ?? [];
      list.push(row);
      byIssue.set(key, list);
    }

    await mapPool(
      [...byIssue.entries()],
      options?.maxConcurrency ?? 5,
      async ([key, rows]) => {
        const [projectIdRaw, issueIidRaw] = key.split(":");
        const projectId = Number(projectIdRaw);
        const issueIid = Number(issueIidRaw);

        try {
          const issue = await this.gitlab.getIssue(projectId, issueIid);
          const labels = new Set(issue.labels);

          for (const row of rows) {
            if (labels.has(row.label)) {
              await sprintManagedLabelOwnershipRepository.verifyOwnership(
                row.id,
                true,
              );
              result.verified += 1;
            } else {
              await sprintManagedLabelOwnershipRepository.verifyOwnership(
                row.id,
                false,
              );
              result.released += 1;
              result.missingFromGitLab += 1;
            }
          }

          for (const label of issue.labels) {
            if (!managed.has(label)) continue;
            const owned = rows.some(
              (row) => row.label === label && row.isActive,
            );
            if (!owned) {
              result.unownedManagedLabels.push({
                projectId,
                issueIid,
                label,
              });
            }
          }
        } catch (error) {
          result.failed.push({
            projectId,
            issueIid,
            message:
              error instanceof Error ? error.message : "Issue unavailable",
          });
        }
      },
    );

    logger.info("sprint-intelligence.discovery.completed", {
      operation: "reconcile-ownership",
      verified: result.verified,
      released: result.released,
      unowned: result.unownedManagedLabels.length,
      failed: result.failed.length,
    });

    return result;
  }
}

export function createSprintIntelligenceReconcileService(): SprintIntelligenceReconcileService | null {
  const config = getGitLabConfig();
  if (!config) return null;
  return new SprintIntelligenceReconcileService(createGitLabProvider(config));
}
