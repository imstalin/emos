"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  badgeClassForStatus,
  humanizeStatus,
} from "@/features/sprint-intelligence/lib/status-presentation";
import type {
  IssueFilters,
  Paginated,
  SprintIssueListItem,
} from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function SprintIssuesTable({
  data,
  filters,
  onFiltersChange,
  onSelectIssue,
  isLoading,
}: {
  data: Paginated<SprintIssueListItem> | undefined;
  filters: IssueFilters;
  onFiltersChange: (next: Partial<IssueFilters>) => void;
  onSelectIssue: (issue: SprintIssueListItem) => void;
  isLoading?: boolean;
}) {
  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <caption className="sr-only">Sprint issue evaluations</caption>
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Issue</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Work Type</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
              <th className="px-3 py-2 font-medium">Completed</th>
              <th className="px-3 py-2 font-medium">Planning</th>
              <th className="px-3 py-2 font-medium">Delivery</th>
              <th className="px-3 py-2 font-medium">Labels</th>
              <th className="px-3 py-2 font-medium">Recommended</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  Loading issues…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  No issues match the current filters.
                </td>
              </tr>
            ) : (
              items.map((issue) => (
                <tr
                  key={issue.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => onSelectIssue(issue)}
                    >
                      #{issue.issueIid}
                    </button>
                    {issue.issueWebUrl ? (
                      <a
                        href={issue.issueWebUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 inline-flex text-muted-foreground hover:text-foreground"
                        aria-label={`Open GitLab issue ${issue.issueIid}`}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs">
                    {issue.projectId}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 align-top">
                    <button
                      type="button"
                      className="truncate text-left hover:underline"
                      title={issue.issueTitle}
                      onClick={() => onSelectIssue(issue)}
                    >
                      {issue.issueTitle}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {issue.workTypes.join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {issue.assignmentTimestamp
                      ? new Date(issue.assignmentTimestamp).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {issue.completionTimestamp
                      ? new Date(issue.completionTimestamp).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge
                      variant="outline"
                      className={badgeClassForStatus(issue.planningStatus)}
                    >
                      {humanizeStatus(issue.planningStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge
                      variant="outline"
                      className={badgeClassForStatus(issue.deliveryStatus)}
                    >
                      {humanizeStatus(issue.deliveryStatus)}
                    </Badge>
                  </td>
                  <td className="max-w-[160px] px-3 py-2 align-top text-xs">
                    <span className="line-clamp-2" title={issue.existingLabels.join(", ")}>
                      {issue.existingLabels.slice(0, 3).join(", ") || "—"}
                      {issue.existingLabels.length > 3
                        ? ` +${issue.existingLabels.length - 3}`
                        : ""}
                    </span>
                  </td>
                  <td className="max-w-[160px] px-3 py-2 align-top text-xs">
                    {[
                      ...issue.recommendedLabelsToAdd.map((l) => `+${l}`),
                      ...issue.recommendedManagedLabelsToRemove.map(
                        (l) => `-${l}`,
                      ),
                    ].join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {issue.evaluationErrorCode ?? issue.evaluationStatus}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {data
            ? `Page ${data.page} of ${data.totalPages} · ${data.total} issues`
            : "—"}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data || data.page <= 1}
            onClick={() => onFiltersChange({ page: filters.page - 1 })}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data || data.page >= data.totalPages}
            onClick={() => onFiltersChange({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
