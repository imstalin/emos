"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { badgeClassForStatus } from "@/features/sprint-intelligence/lib/status-presentation";
import type {
  LabelActionItem,
  Paginated,
} from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function SprintLabelActionsTable({
  data,
  page,
  onPageChange,
  actionFilter,
  statusFilter,
  onActionFilter,
  onStatusFilter,
  isLoading,
}: {
  data: Paginated<LabelActionItem> | undefined;
  page: number;
  onPageChange: (page: number) => void;
  actionFilter: string;
  statusFilter: string;
  onActionFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  isLoading?: boolean;
}) {
  const items = data?.items ?? [];
  const summary = {
    add: items.filter((i) => i.action === "ADD").length,
    remove: items.filter((i) => i.action === "REMOVE").length,
    failed: items.filter((i) => i.status === "FAILED").length,
    noop: items.filter((i) => i.status === "NOOP").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Page adds: {summary.add}</span>
        <span>Page removes: {summary.remove}</span>
        <span>No-op: {summary.noop}</span>
        <span>Failed: {summary.failed}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={actionFilter}
          onChange={(event) => onActionFilter(event.target.value)}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          <option value="ADD">Add</option>
          <option value="REMOVE">Remove</option>
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(event) => onStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {["PLANNED", "APPLIED", "SKIPPED", "NOOP", "FAILED", "REJECTED"].map(
            (status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Sprint label actions</caption>
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Issue</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ownership</th>
              <th className="px-3 py-2">Planned</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Loading label actions…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No label actions for this run.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">#{item.issueIid}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.projectId}</td>
                  <td className="px-3 py-2">{item.label}</td>
                  <td className="px-3 py-2">{item.action}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={badgeClassForStatus(item.status)}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {String(item.ownedBefore)} →{" "}
                    {item.ownedAfter == null ? "—" : String(item.ownedAfter)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(item.plannedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {item.errorCode ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!data || page >= data.totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
