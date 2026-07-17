"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  fetchSprintFailures,
  fetchSprintIntelligenceConfig,
  fetchSprintIntelligenceStatus,
  fetchSprintIssueEvaluation,
  fetchSprintIssueEvaluations,
  fetchSprintLabelActions,
  fetchSprintMilestones,
  fetchSprintRun,
  fetchSprintRuns,
  requestSprintAnalysis,
  requestSprintApply,
} from "@/features/sprint-intelligence/api/sprint-intelligence-client";
import type { IssueFilters } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "RUNNING"]);

export const sprintIntelligenceKeys = {
  all: ["sprint-intelligence"] as const,
  status: () => [...sprintIntelligenceKeys.all, "status"] as const,
  milestones: () => [...sprintIntelligenceKeys.all, "milestones"] as const,
  runs: (params: Record<string, unknown>) =>
    [...sprintIntelligenceKeys.all, "runs", params] as const,
  run: (runId: string) =>
    [...sprintIntelligenceKeys.all, "run", runId] as const,
  issues: (runId: string, filters: IssueFilters) =>
    [...sprintIntelligenceKeys.all, "issues", runId, filters] as const,
  issue: (runId: string, evaluationId: string) =>
    [...sprintIntelligenceKeys.all, "issue", runId, evaluationId] as const,
  labelActions: (runId: string, params: Record<string, unknown>) =>
    [...sprintIntelligenceKeys.all, "label-actions", runId, params] as const,
  failures: (runId: string) =>
    [...sprintIntelligenceKeys.all, "failures", runId] as const,
  config: () => [...sprintIntelligenceKeys.all, "config"] as const,
};

export function useSprintIntelligenceStatus() {
  return useQuery({
    queryKey: sprintIntelligenceKeys.status(),
    queryFn: fetchSprintIntelligenceStatus,
    staleTime: 30_000,
  });
}

export function useSprintMilestones(enabled = true) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.milestones(),
    queryFn: fetchSprintMilestones,
    enabled,
    staleTime: 60_000,
  });
}

export function useSprintRuns(
  params: {
    page?: number;
    pageSize?: number;
    mode?: string;
    status?: string;
    triggerType?: string;
    milestoneId?: number;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.runs(params),
    queryFn: () => fetchSprintRuns(params),
    enabled,
  });
}

export function useSprintRun(runId: string | null, poll = false) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.run(runId ?? "none"),
    queryFn: () => fetchSprintRun(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      if (!poll || typeof document !== "undefined" && document.hidden) {
        return false;
      }
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.has(status) ? 3000 : false;
    },
  });
}

export function useSprintIssueEvaluations(
  runId: string | null,
  filters: IssueFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.issues(runId ?? "none", filters),
    queryFn: () => fetchSprintIssueEvaluations(runId!, filters),
    enabled: Boolean(runId) && enabled,
  });
}

export function useSprintIssueEvaluation(
  runId: string | null,
  evaluationId: string | null,
) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.issue(
      runId ?? "none",
      evaluationId ?? "none",
    ),
    queryFn: () => fetchSprintIssueEvaluation(runId!, evaluationId!),
    enabled: Boolean(runId && evaluationId),
  });
}

export function useSprintLabelActions(
  runId: string | null,
  params: { page?: number; pageSize?: number; action?: string; status?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.labelActions(runId ?? "none", params),
    queryFn: () => fetchSprintLabelActions(runId!, params),
    enabled: Boolean(runId) && enabled,
  });
}

export function useSprintFailures(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.failures(runId ?? "none"),
    queryFn: () => fetchSprintFailures(runId!),
    enabled: Boolean(runId) && enabled,
  });
}

export function useSprintIntelligenceConfig(enabled = true) {
  return useQuery({
    queryKey: sprintIntelligenceKeys.config(),
    queryFn: fetchSprintIntelligenceConfig,
    enabled,
    staleTime: 60_000,
  });
}

export function useRequestSprintAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestSprintAnalysis,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: sprintIntelligenceKeys.all,
      });
    },
  });
}

export function useRequestSprintApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestSprintApply,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: sprintIntelligenceKeys.all,
      });
    },
  });
}

export function isActiveRunStatus(status?: string | null) {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}
