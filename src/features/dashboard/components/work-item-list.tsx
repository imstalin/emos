import type { WorkItemSummary } from "@/domain/types/dashboard";
import { getScopedTypeLabel } from "@/domain/backlog/classify-product-backlog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <ScrollArea className={compact ? "max-h-64" : "max-h-96"}>
      <ul className="divide-y">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium leading-snug">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.projectName}
                  {item.assigneeName ? ` · ${item.assigneeName}` : ""}
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
    </ScrollArea>
  );
}
