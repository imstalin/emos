"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Play, RefreshCw } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildExportUrl } from "@/features/sprint-intelligence/api/sprint-intelligence-client";
import { AnalyzeSprintDialog } from "@/features/sprint-intelligence/components/analyze-sprint-dialog";
import { ApplySprintDialog } from "@/features/sprint-intelligence/components/apply-sprint-dialog";
import { FeatureStatusBanner } from "@/features/sprint-intelligence/components/feature-status-banner";
import { MilestoneSelector } from "@/features/sprint-intelligence/components/milestone-selector";
import { RunStatusPanel } from "@/features/sprint-intelligence/components/run-status-panel";
import { SprintConfigView } from "@/features/sprint-intelligence/components/sprint-config-view";
import { SprintFailuresTable } from "@/features/sprint-intelligence/components/sprint-failures-table";
import { SprintIssueDetailDrawer } from "@/features/sprint-intelligence/components/sprint-issue-detail-drawer";
import { SprintIssueFilters } from "@/features/sprint-intelligence/components/sprint-issue-filters";
import { SprintIssuesTable } from "@/features/sprint-intelligence/components/sprint-issues-table";
import { SprintLabelActionsTable } from "@/features/sprint-intelligence/components/sprint-label-actions-table";
import { SprintOutcomeChart } from "@/features/sprint-intelligence/components/sprint-outcome-chart";
import { SprintRunHistory } from "@/features/sprint-intelligence/components/sprint-run-history";
import { SprintSummaryCards } from "@/features/sprint-intelligence/components/sprint-summary-cards";
import { WorkTypeChart } from "@/features/sprint-intelligence/components/work-type-chart";
import {
  isActiveRunStatus,
  useRequestSprintAnalysis,
  useRequestSprintApply,
  useSprintIntelligenceStatus,
  useSprintIssueEvaluations,
  useSprintLabelActions,
  useSprintMilestones,
  useSprintRun,
} from "@/features/sprint-intelligence/hooks/use-sprint-intelligence";
import type {
  IssueFilters,
  SprintIntelligenceMilestone,
  SprintIssueListItem,
} from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

const DEFAULT_FILTERS: IssueFilters = {
  page: 1,
  pageSize: 25,
  sortBy: "issueIid",
  sortDir: "asc",
};

function parseFilters(params: URLSearchParams): IssueFilters {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "25");
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
    projectId: params.get("projectId")
      ? Number(params.get("projectId"))
      : undefined,
    planningStatus: params.get("planningStatus") ?? undefined,
    deliveryStatus: params.get("deliveryStatus") ?? undefined,
    workType: params.get("workType") ?? undefined,
    state: (params.get("state") as "opened" | "closed" | null) ?? undefined,
    excludedFromCommitment:
      params.get("excludedFromCommitment") == null
        ? undefined
        : params.get("excludedFromCommitment") === "true",
    hasRecommendedChanges:
      params.get("hasRecommendedChanges") == null
        ? undefined
        : params.get("hasRecommendedChanges") === "true",
    hasEvaluationError:
      params.get("hasEvaluationError") == null
        ? undefined
        : params.get("hasEvaluationError") === "true",
    existingLabel: params.get("existingLabel") ?? undefined,
    search: params.get("search") ?? undefined,
    sortBy: params.get("sortBy") ?? "issueIid",
    sortDir: (params.get("sortDir") as "asc" | "desc" | null) ?? "asc",
  };
}

function countActiveFilters(filters: IssueFilters): number {
  return [
    filters.projectId,
    filters.planningStatus,
    filters.deliveryStatus,
    filters.workType,
    filters.state,
    filters.excludedFromCommitment,
    filters.hasRecommendedChanges,
    filters.hasEvaluationError,
    filters.existingLabel,
    filters.search,
  ].filter((value) => value != null && value !== "").length;
}

export function SprintIntelligenceView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusQuery = useSprintIntelligenceStatus();
  const milestonesQuery = useSprintMilestones();

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(
    () => {
      const fromUrl = searchParams.get("milestoneId");
      return fromUrl ? Number(fromUrl) : null;
    },
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    searchParams.get("runId"),
  );
  const [runIdPinned, setRunIdPinned] = useState(Boolean(searchParams.get("runId")));
  const [applyRunId, setApplyRunId] = useState<string | null>(null);
  const [tab, setTab] = useState(searchParams.get("tab") ?? "overview");
  const [filters, setFilters] = useState<IssueFilters>(() =>
    parseFilters(searchParams),
  );
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<
    string | null
  >(null);
  const [labelPage, setLabelPage] = useState(1);
  const [labelActionFilter, setLabelActionFilter] = useState("");
  const [labelStatusFilter, setLabelStatusFilter] = useState("");

  const analyzeMutation = useRequestSprintAnalysis();
  const applyMutation = useRequestSprintApply();

  const milestones = milestonesQuery.data?.milestones ?? [];
  const activeMilestones = milestones.filter((m) => m.isActive);
  const defaultMilestoneId =
    activeMilestones.length === 1 ? activeMilestones[0].milestoneId : null;
  const effectiveMilestoneId = selectedMilestoneId ?? defaultMilestoneId;
  const selectedMilestone =
    milestones.find((m) => m.milestoneId === effectiveMilestoneId) ?? null;
  const defaultRunId =
    selectedMilestone?.activeRun?.id ??
    selectedMilestone?.latestAnalysis?.id ??
    null;
  const effectiveRunId = runIdPinned ? selectedRunId : selectedRunId ?? defaultRunId;

  const runQuery = useSprintRun(effectiveRunId, true);
  const applyRunQuery = useSprintRun(applyRunId, true);
  const issuesQuery = useSprintIssueEvaluations(
    effectiveRunId,
    filters,
    Boolean(effectiveRunId) &&
      !isActiveRunStatus(runQuery.data?.status) &&
      (tab === "issues" || tab === "overview"),
  );
  const labelActionsQuery = useSprintLabelActions(
    effectiveRunId,
    {
      page: labelPage,
      pageSize: 25,
      action: labelActionFilter || undefined,
      status: labelStatusFilter || undefined,
    },
    tab === "labels" && Boolean(effectiveRunId),
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (effectiveMilestoneId != null) {
      params.set("milestoneId", String(effectiveMilestoneId));
    }
    if (effectiveRunId) params.set("runId", effectiveRunId);
    if (tab !== "overview") params.set("tab", tab);
    for (const [key, value] of Object.entries(filters)) {
      if (
        value == null ||
        value === "" ||
        (key === "page" && value === 1) ||
        (key === "pageSize" && value === 25) ||
        (key === "sortBy" && value === "issueIid") ||
        (key === "sortDir" && value === "asc")
      ) {
        continue;
      }
      params.set(key, String(value));
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [effectiveMilestoneId, effectiveRunId, filters, pathname, router, tab]);

  const status = statusQuery.data;
  const run = runQuery.data;
  const featureEnabled = Boolean(status?.enabled);
  const canAnalyze =
    featureEnabled &&
    Boolean(selectedMilestone) &&
    Boolean(selectedMilestone?.startDate) &&
    Boolean(selectedMilestone?.dueDate) &&
    (selectedMilestone?.projectIds.length ?? 0) > 0 &&
    !analyzeMutation.isPending &&
    !isActiveRunStatus(run?.status);

  const canApply =
    featureEnabled &&
    status &&
    !status.dryRunOnly &&
    Boolean(run?.applyEligible) &&
    !applyMutation.isPending &&
    !isActiveRunStatus(applyRunQuery.data?.status);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters],
  );

  function updateFilters(next: Partial<IssueFilters>) {
    setFilters((prev) => ({ ...prev, ...next }));
  }

  function handleMilestoneSelect(milestone: SprintIntelligenceMilestone) {
    setSelectedMilestoneId(milestone.milestoneId);
    setSelectedRunId(
      milestone.activeRun?.id ?? milestone.latestAnalysis?.id ?? null,
    );
    setRunIdPinned(false);
    setApplyRunId(null);
    setFilters(DEFAULT_FILTERS);
  }

  async function confirmAnalyze() {
    if (!selectedMilestone || !status) return;
    setAnalyzeError(null);
    try {
      const result = await analyzeMutation.mutateAsync({
        projectIds: selectedMilestone.projectIds,
        milestone: {
          id: selectedMilestone.milestoneId,
          title: selectedMilestone.title,
          startDate: selectedMilestone.startDate,
          dueDate: selectedMilestone.dueDate,
        },
      });
      setSelectedRunId(result.runId);
      setRunIdPinned(true);
      setAnalyzeOpen(false);
      setTab("overview");
    } catch (error) {
      setAnalyzeError(
        error instanceof Error ? error.message : "Failed to start analysis",
      );
    }
  }

  async function confirmApply() {
    if (!run) return;
    setApplyError(null);
    try {
      const result = await applyMutation.mutateAsync({
        sourceAnalysisRunId: run.id,
        confirm: true,
      });
      setApplyRunId(result.runId);
      setApplyOpen(false);
      setTab("labels");
    } catch (error) {
      setApplyError(
        error instanceof Error ? error.message : "Failed to start apply",
      );
    }
  }

  return (
    <>
      <AppHeader
        title="Sprint Intelligence"
        description="Dry-run classification, commitment metrics, and confirmed label apply"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void statusQuery.refetch();
                void milestonesQuery.refetch();
                void runQuery.refetch();
              }}
              aria-label="Refresh sprint intelligence"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Refresh
            </Button>
            {effectiveRunId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={
                  <a
                    href={buildExportUrl(effectiveRunId, "issues", filters)}
                    download
                  />
                }
              >
                <Download className="size-3.5" aria-hidden />
                Export CSV
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={!canAnalyze}
              onClick={() => {
                setAnalyzeError(null);
                setAnalyzeOpen(true);
              }}
            >
              <Play className="size-3.5" aria-hidden />
              Analyze Sprint
            </Button>
            {canApply ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setApplyError(null);
                  setApplyOpen(true);
                }}
              >
                Apply Label Changes
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <FeatureStatusBanner status={status} />

        {!featureEnabled ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature disabled</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Sprint Intelligence is disabled. Enable{" "}
              <code className="rounded bg-muted px-1">
                SPRINT_INTELLIGENCE_ENABLED
              </code>{" "}
              to run analyses. Navigation remains visible so operators can see
              the safety status.
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-4 p-4">
            <MilestoneSelector
              milestones={milestones}
              selectedId={effectiveMilestoneId}
              onSelect={handleMilestoneSelect}
              disabled={milestonesQuery.isLoading}
            />
            {milestonesQuery.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {(milestonesQuery.error as Error).message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <RunStatusPanel
            run={run}
            label={
              isActiveRunStatus(run?.status)
                ? "Active Run"
                : run?.triggerType === "SPRINT_END"
                  ? "Final Sprint-End Analysis"
                  : "Latest Analysis"
            }
          />
          <RunStatusPanel
            run={applyRunQuery.data}
            label="Latest Apply"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="flex h-auto flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="labels">Label Changes</TabsTrigger>
            <TabsTrigger value="failures">Failures</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {run && !isActiveRunStatus(run.status) ? (
              <>
                <SprintSummaryCards
                  metrics={run.metrics}
                  totalIssues={run.evaluationCount}
                  unableToDetermine={run.unableToDetermineCount}
                  onFilter={(filter) => {
                    updateFilters({ ...DEFAULT_FILTERS, ...filter });
                    setTab("issues");
                  }}
                />
                <SprintOutcomeChart
                  metrics={run.metrics}
                  unableToDetermine={run.unableToDetermineCount}
                />
                <WorkTypeChart metrics={run.metrics} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isActiveRunStatus(run?.status)
                  ? "Summary metrics will appear when the run completes."
                  : "Run a dry-run analysis to see sprint summary metrics."}
              </p>
            )}
          </TabsContent>

          <TabsContent value="issues" className="space-y-3">
            <SprintIssueFilters
              filters={filters}
              onChange={updateFilters}
              onClear={() => setFilters(DEFAULT_FILTERS)}
              activeCount={activeFilterCount}
            />
            <SprintIssuesTable
              data={issuesQuery.data}
              filters={filters}
              onFiltersChange={updateFilters}
              onSelectIssue={(issue: SprintIssueListItem) =>
                setSelectedEvaluationId(issue.id)
              }
              isLoading={issuesQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="labels" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {effectiveRunId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={buildExportUrl(effectiveRunId, "label-actions")}
                      download
                    />
                  }
                >
                  <Download className="size-3.5" aria-hidden />
                  Export label actions
                </Button>
              ) : null}
            </div>
            <SprintLabelActionsTable
              data={labelActionsQuery.data}
              page={labelPage}
              onPageChange={setLabelPage}
              actionFilter={labelActionFilter}
              statusFilter={labelStatusFilter}
              onActionFilter={(value) => {
                setLabelActionFilter(value);
                setLabelPage(1);
              }}
              onStatusFilter={(value) => {
                setLabelStatusFilter(value);
                setLabelPage(1);
              }}
              isLoading={labelActionsQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="failures">
            <SprintFailuresTable
              runId={effectiveRunId}
              enabled={tab === "failures"}
            />
          </TabsContent>

          <TabsContent value="history">
            <SprintRunHistory
              milestoneId={effectiveMilestoneId}
              enabled={tab === "history"}
              onViewRun={(runId) => {
                setSelectedRunId(runId);
                setRunIdPinned(true);
                setTab("overview");
              }}
            />
          </TabsContent>

          <TabsContent value="configuration">
            <SprintConfigView enabled={tab === "configuration"} />
          </TabsContent>
        </Tabs>
      </div>

      <AnalyzeSprintDialog
        open={analyzeOpen}
        onOpenChange={setAnalyzeOpen}
        milestone={selectedMilestone}
        timezone={status?.timezone ?? "Asia/Kolkata"}
        allowFirstDayAdditions={status?.allowFirstDayAdditions ?? true}
        dryRunOnly={status?.dryRunOnly ?? true}
        projectCount={selectedMilestone?.projectIds.length ?? 0}
        isSubmitting={analyzeMutation.isPending}
        error={analyzeError}
        onConfirm={() => void confirmAnalyze()}
      />

      <ApplySprintDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        run={run ?? null}
        isSubmitting={applyMutation.isPending}
        error={applyError}
        onConfirm={() => void confirmApply()}
      />

      <SprintIssueDetailDrawer
        open={Boolean(selectedEvaluationId)}
        onOpenChange={(open) => {
          if (!open) setSelectedEvaluationId(null);
        }}
        runId={effectiveRunId}
        evaluationId={selectedEvaluationId}
      />
    </>
  );
}
