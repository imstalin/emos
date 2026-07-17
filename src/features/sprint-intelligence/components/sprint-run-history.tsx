"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSprintRuns } from "@/features/sprint-intelligence/hooks/use-sprint-intelligence";
import {
  badgeClassForStatus,
  formatPercent,
  shortRunId,
  TRIGGER_LABELS,
} from "@/features/sprint-intelligence/lib/status-presentation";
import type { SprintMetrics } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function SprintRunHistory({
  milestoneId,
  enabled,
  onViewRun,
}: {
  milestoneId: number | null;
  enabled: boolean;
  onViewRun: (runId: string) => void;
}) {
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const runs = useSprintRuns(
    {
      page: 1,
      pageSize: 25,
      milestoneId: milestoneId ?? undefined,
      mode: mode || undefined,
      status: status || undefined,
    },
    enabled && milestoneId != null,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          aria-label="Filter by mode"
        >
          <option value="">All modes</option>
          <option value="ANALYZE">Analyze</option>
          <option value="APPLY">Apply</option>
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {[
            "PENDING",
            "QUEUED",
            "RUNNING",
            "COMPLETED",
            "PARTIAL",
            "FAILED",
            "CANCELLED",
            "STALE",
            "REJECTED",
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {!milestoneId ? (
        <p className="text-sm text-muted-foreground">
          Select a milestone to view run history.
        </p>
      ) : runs.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      ) : (runs.data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          No runs recorded for this milestone.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <caption className="sr-only">Sprint intelligence run history</caption>
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Requested</th>
                <th className="px-3 py-2">Completed</th>
                <th className="px-3 py-2">Reliability</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.items.map((run) => {
                const metrics = run.metrics as SprintMetrics;
                return (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {shortRunId(run.id)}
                    </td>
                    <td className="px-3 py-2">{run.mode}</td>
                    <td className="px-3 py-2">
                      {TRIGGER_LABELS[run.triggerType] ?? run.triggerType}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={badgeClassForStatus(run.status)}
                      >
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(run.requestedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {run.completedAt
                        ? new Date(run.completedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatPercent(metrics?.commitmentReliabilityPercent)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {run.sourceAnalysisRunId
                        ? shortRunId(run.sourceAnalysisRunId)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onViewRun(run.id)}
                      >
                        View run
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
