"use client";

import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  badgeClassForStatus,
  shortRunId,
  TRIGGER_LABELS,
} from "@/features/sprint-intelligence/lib/status-presentation";
import type { SprintRunDetail } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";
import { isActiveRunStatus } from "@/features/sprint-intelligence/hooks/use-sprint-intelligence";

export function RunStatusPanel({
  run,
  label = "Latest Analysis",
}: {
  run: SprintRunDetail | undefined;
  label?: string;
}) {
  if (!run) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Run status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No sprint analysis has been run for this milestone. Run a dry-run
          analysis to classify sprint issues.
        </CardContent>
      </Card>
    );
  }

  const active = isActiveRunStatus(run.status);
  const summary = run.summary ?? {};
  const evaluated =
    typeof summary.issuesEvaluated === "number"
      ? summary.issuesEvaluated
      : run.evaluationCount;
  const failed =
    typeof summary.failed === "number" ? summary.failed : run.failureCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{label}</CardTitle>
          <Badge
            variant="outline"
            className={badgeClassForStatus(run.status)}
          >
            {active ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
            {run.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Run</dt>
            <dd className="font-mono text-xs">{shortRunId(run.id)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Trigger</dt>
            <dd>{TRIGGER_LABELS[run.triggerType] ?? run.triggerType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Requested</dt>
            <dd>{new Date(run.requestedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd>
              {run.completedAt
                ? new Date(run.completedAt).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>

        {active ? (
          <div
            className="space-y-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              aria-label="Analysis in progress"
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              {run.status === "QUEUED" || run.status === "PENDING"
                ? "The analysis was queued but may not have started. Verify that the application worker is running."
                : "Analysis is running. This page refreshes automatically."}
            </p>
          </div>
        ) : null}

        {run.status === "PARTIAL" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            The analysis completed with partial results. {evaluated} issues were
            evaluated and {failed} could not be processed.
          </p>
        ) : null}

        {run.status === "FAILED" || run.status === "REJECTED" ? (
          <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
            {run.errorMessage ?? "The run failed. Review the Failures tab."}
          </p>
        ) : null}

        {run.stale ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-muted-foreground">
            This analysis is stale and cannot be applied. Re-run analysis first.
          </p>
        ) : null}

        {run.consumedByApplyRunId ? (
          <p className="text-xs text-muted-foreground">
            Source analysis already consumed by apply run{" "}
            <span className="font-mono">
              {shortRunId(run.consumedByApplyRunId)}
            </span>
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
