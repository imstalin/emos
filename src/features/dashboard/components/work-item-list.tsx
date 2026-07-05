import type { WorkItemSummary } from "@/domain/types/dashboard";
import { ExternalLink } from "lucide-react";

import { getScopedTypeLabel } from "@/domain/backlog/classify-product-backlog";
import { Badge } from "@/components/ui/badge";
import {
  formatRelativeDate,
  getPriorityVariant,
  getStateLabel,
  isOverdue,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface WorkItemListProps {
  items: WorkItemSummary[];
  emptyMessage?: string;
  compact?: boolean;
}

export function WorkItemList({
  items,
  emptyMessage = "No items",
  compact = false,
}: WorkItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-y-auto overscroll-contain",
        compact ? "max-h-64" : "max-h-96",
      )}
    >
      <ul className="divide-y">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {item.webUrl ? (
                    <a
                      href={item.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium leading-snug hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium leading-snug">
                      {item.title}
                    </p>
                  )}
                  {item.webUrl ? (
                    <a
                      href={item.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Open in GitLab"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.projectName}
                  {item.assigneeName ? ` · Dev: ${item.assigneeName}` : ""}
                  {item.qaOwnerName ? ` · QA: ${item.qaOwnerName}` : ""}
                </p>
              </div>
              <Badge variant={getPriorityVariant(item.priority)} className="shrink-0">
                {item.priority}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {getStateLabel(item.state)}
              </Badge>
              {getScopedTypeLabel(item.labels) ? (
                <Badge variant="secondary" className="text-[10px]">
                  Type::{getScopedTypeLabel(item.labels)}
                </Badge>
              ) : null}
              {item.milestoneTitle ? (
                <Badge variant="outline" className="text-[10px]">
                  {item.milestoneTitle}
                </Badge>
              ) : null}
              {item.labels
                .filter((label) => !/^type::/i.test(label))
                .slice(0, 3)
                .map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              ))}
              {item.dueDate ? (
                <span
                  className={cn(
                    "ml-auto text-xs",
                    isOverdue(item.dueDate)
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  Due {formatRelativeDate(item.dueDate)}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
