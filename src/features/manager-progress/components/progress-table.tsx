import type { ManagerProgressRow } from "@/domain/types/manager-progress";
import { progressIndicatorLabel } from "@/domain/manager-progress/progress-detector";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/formatters";

interface ProgressTableProps {
  rows: ManagerProgressRow[];
  onSelect?: (workItemId: string) => void;
}

function attentionBadge(row: ManagerProgressRow) {
  if (row.managerAttention) {
    return <Badge variant="destructive">Attention</Badge>;
  }
  return <span className="text-muted-foreground">—</span>;
}

export function ProgressTable({ rows, onSelect }: ProgressTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No work items match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[960px] text-left text-sm">
        <caption className="sr-only">Engineering manager progress</caption>
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Progress Today</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Blocker</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium">Manager Attention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.workItemId}
              className={`border-b last:border-0 ${onSelect ? "cursor-pointer hover:bg-muted/50" : ""}`}
              onClick={() => onSelect?.(row.workItemId)}
            >
              <td className="px-3 py-2 font-medium">
                {row.priorityName ?? row.title}
              </td>
              <td className="px-3 py-2">{row.ownerName ?? "—"}</td>
              <td className="px-3 py-2">{row.teamName ?? "—"}</td>
              <td className="px-3 py-2">
                {progressIndicatorLabel(row.progressToday)}
              </td>
              <td className="px-3 py-2">{row.stageLabel}</td>
              <td className="px-3 py-2 max-w-[220px] truncate">
                {row.blocker ?? "—"}
              </td>
              <td className="px-3 py-2">
                {row.targetDate ? formatRelativeDate(row.targetDate) : "—"}
              </td>
              <td className="px-3 py-2">{attentionBadge(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
