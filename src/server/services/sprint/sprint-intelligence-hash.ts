import { createHash } from "node:crypto";

import type {
  SprintIntelligenceRuleConfig,
  SprintMilestoneInput,
} from "@/domain/types/sprint-intelligence";
import type { SprintMilestoneAnalysisResult } from "@/domain/types/sprint-intelligence-gitlab";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Prisma/Postgres JSON round-trips can nudge IEEE floats by ~1 ULP.
 * Normalize so in-memory metrics and persisted metrics hash identically.
 */
export function normalizeJsonNumber(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (Number.isInteger(value)) return value;
  return Number(value.toPrecision(12));
}

export function toIsoTimestamp(
  value: Date | string | null | undefined,
): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
}

/** Deterministic JSON canonicalization (sorted object keys). */
export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (isPlainObject(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return normalizeJsonNumber(value);
  }
  return value;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalizeJson(value));
}

export function canonicalizeSprintAnalysisInput(input: {
  projectIds: Array<string | number>;
  milestone: SprintMilestoneInput;
  ruleConfig: SprintIntelligenceRuleConfig;
  allowTitleOnlyMilestoneMatch?: boolean;
}): string {
  return canonicalizeJson({
    projectIds: [...input.projectIds]
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => a - b),
    milestone: {
      id: input.milestone.id,
      title: input.milestone.title,
      startDate: input.milestone.startDate,
      dueDate: input.milestone.dueDate,
    },
    ruleConfig: input.ruleConfig,
    allowTitleOnlyMilestoneMatch: input.allowTitleOnlyMilestoneMatch ?? false,
  });
}

export function hashSprintAnalysisInput(
  input: Parameters<typeof canonicalizeSprintAnalysisInput>[0],
): string {
  return sha256Hex(canonicalizeSprintAnalysisInput(input));
}

/**
 * Hash a stable subset of analysis result used for apply integrity.
 * Excludes wall-clock timestamps that vary between identical classifications.
 */
export function canonicalizeSprintAnalysisResult(
  result: Pick<
    SprintMilestoneAnalysisResult,
    "milestone" | "managedLabels" | "metrics" | "evaluations" | "labelPlans" | "summary"
  >,
): string {
  return canonicalizeJson({
    milestone: result.milestone,
    managedLabels: result.managedLabels,
    metrics: result.metrics,
    summary: result.summary,
    labelPlans: [...result.labelPlans]
      .map((plan) => ({
        projectId: Number(plan.projectId),
        issueIid: plan.issueIid,
        labelsToAdd: [...plan.labelsToAdd].sort(),
        labelsToRemove: [...plan.labelsToRemove].sort(),
      }))
      .sort((a, b) => {
        const projectDelta = a.projectId - b.projectId;
        if (projectDelta !== 0) return projectDelta;
        return a.issueIid - b.issueIid;
      }),
    evaluations: [...result.evaluations]
      .map((evaluation) => ({
        projectId: evaluation.projectId,
        issueId: evaluation.issueId,
        issueIid: evaluation.issueIid,
        planningStatus: evaluation.planningStatus,
        deliveryStatus: evaluation.deliveryStatus,
        workTypes: [...evaluation.workTypes].sort(),
        excludedFromCommitment: evaluation.excludedFromCommitment,
        completedWithinSprint: evaluation.completedWithinSprint,
        existingLabels: [...evaluation.existingLabels].sort(),
        labelsToAdd: [...evaluation.labelsToAdd].sort(),
        managedLabelsToRemove: [...evaluation.managedLabelsToRemove].sort(),
        reasonCodes: [...evaluation.reasonCodes].sort(),
        assignmentTimestamp: toIsoTimestamp(evaluation.assignmentTimestamp),
        closedAt: toIsoTimestamp(evaluation.closedAt),
      }))
      .sort((a, b) => {
        const projectDelta = a.projectId - b.projectId;
        if (projectDelta !== 0) return projectDelta;
        return a.issueIid - b.issueIid;
      }),
  });
}

export function hashSprintAnalysisResult(
  result: Parameters<typeof canonicalizeSprintAnalysisResult>[0],
): string {
  return sha256Hex(canonicalizeSprintAnalysisResult(result));
}

export function buildAnalyzeRunKey(params: {
  milestoneId: number;
  projectIds: number[];
  inputHash: string;
  triggerType: string;
  /** Optional evaluation window (e.g. hour bucket for DURING_SPRINT). */
  evaluationWindow?: string;
}): string {
  const projectSetHash = sha256Hex(
    [...params.projectIds].sort((a, b) => a - b).join(","),
  ).slice(0, 16);
  const window = params.evaluationWindow ?? "default";
  return `analyze:${params.milestoneId}:${projectSetHash}:${params.triggerType}:${window}:${params.inputHash.slice(0, 24)}`;
}

export function buildApplyRunKey(params: {
  sourceAnalysisRunId: string;
  analysisHash: string;
}): string {
  return `apply:${params.sourceAnalysisRunId}:${params.analysisHash}`;
}

/**
 * Deterministic run keys are reused for active/successful idempotency.
 * After a terminal failure (or a manual re-analyze), allocate a unique key
 * so Prisma's unique(runKey) constraint is not violated.
 */
export function withUniqueRunKeySuffix(baseRunKey: string): string {
  return `${baseRunKey}:attempt:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeErrorMessage(
  message: string | null | undefined,
  maxLength = 500,
): string | null {
  if (!message) return null;
  const cleaned = message
    .replace(/PRIVATE-TOKEN:\s*\S+/gi, "PRIVATE-TOKEN: [redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}…`
    : cleaned;
}
