import type { SprintManagedLabelOwnership } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Ownership policy (GitLab labels are not milestone-scoped):
 * - Only one active automation ownership per (projectId, issueIid, label).
 * - When the same managed outcome label is claimed for a newer milestone,
 *   the older active ownership is released and a new record is activated.
 * - Never remove a label unless active ownership exists for that issue+label.
 * - Dry-run never creates ownership.
 * - Manually pre-existing managed labels are never auto-claimed.
 */
export class SprintManagedLabelOwnershipRepository {
  async listActiveForIssues(
    issues: Array<{ projectId: number; issueIid: number }>,
  ): Promise<SprintManagedLabelOwnership[]> {
    if (issues.length === 0) return [];

    return db.sprintManagedLabelOwnership.findMany({
      where: {
        isActive: true,
        OR: issues.map((issue) => ({
          projectId: issue.projectId,
          issueIid: issue.issueIid,
        })),
      },
    });
  }

  async listActiveForIssue(
    projectId: number,
    issueIid: number,
  ): Promise<SprintManagedLabelOwnership[]> {
    return db.sprintManagedLabelOwnership.findMany({
      where: { projectId, issueIid, isActive: true },
    });
  }

  async getActiveOwnership(
    projectId: number,
    issueIid: number,
    label: string,
  ): Promise<SprintManagedLabelOwnership | null> {
    return db.sprintManagedLabelOwnership.findFirst({
      where: { projectId, issueIid, label, isActive: true },
    });
  }

  /**
   * Acquire ownership after GitLab confirms the label is present.
   * Releases any prior active ownership for the same issue+label (other milestone).
   */
  async acquireOwnership(params: {
    projectId: number;
    issueIid: number;
    milestoneId: number;
    label: string;
    sourceRunId: string;
    sourceLabelActionId: string;
    ruleId?: string | null;
  }): Promise<SprintManagedLabelOwnership> {
    return db.$transaction(async (tx) => {
      await tx.sprintManagedLabelOwnership.updateMany({
        where: {
          projectId: params.projectId,
          issueIid: params.issueIid,
          label: params.label,
          isActive: true,
          NOT: {
            milestoneId: params.milestoneId,
          },
        },
        data: {
          isActive: false,
          releasedAt: new Date(),
        },
      });

      const existing = await tx.sprintManagedLabelOwnership.findUnique({
        where: {
          projectId_issueIid_milestoneId_label: {
            projectId: params.projectId,
            issueIid: params.issueIid,
            milestoneId: params.milestoneId,
            label: params.label,
          },
        },
      });

      if (existing) {
        return tx.sprintManagedLabelOwnership.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            releasedAt: null,
            acquiredAt: new Date(),
            lastVerifiedAt: new Date(),
            sourceRunId: params.sourceRunId,
            sourceLabelActionId: params.sourceLabelActionId,
            ruleId: params.ruleId ?? null,
          },
        });
      }

      return tx.sprintManagedLabelOwnership.create({
        data: {
          projectId: params.projectId,
          issueIid: params.issueIid,
          milestoneId: params.milestoneId,
          label: params.label,
          sourceRunId: params.sourceRunId,
          sourceLabelActionId: params.sourceLabelActionId,
          ruleId: params.ruleId ?? null,
          isActive: true,
          lastVerifiedAt: new Date(),
        },
      });
    });
  }

  async releaseOwnership(
    id: string,
  ): Promise<SprintManagedLabelOwnership> {
    return db.sprintManagedLabelOwnership.update({
      where: { id },
      data: {
        isActive: false,
        releasedAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });
  }

  async verifyOwnership(
    id: string,
    stillPresent: boolean,
  ): Promise<SprintManagedLabelOwnership> {
    if (!stillPresent) {
      return this.releaseOwnership(id);
    }
    return db.sprintManagedLabelOwnership.update({
      where: { id },
      data: { lastVerifiedAt: new Date() },
    });
  }
}

export const sprintManagedLabelOwnershipRepository =
  new SprintManagedLabelOwnershipRepository();
