import type { GitLabActivityItem } from "@/domain/types/gitlab-activity";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatRelativeDate,
  getHealthClass,
  getHealthLabel,
  getPriorityVariant,
  getStateLabel,
  isOverdue,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface GitLabActivityTableProps {
  items: GitLabActivityItem[];
}

export function GitLabActivityTable({ items }: GitLabActivityTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        No work items match your filters.
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[calc(100vh-28rem)]">
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
                  {item.gitlabIid != null ? ` · #${item.gitlabIid}` : ""}
                  {item.assigneeName ? ` · ${item.assigneeName}` : ""}
                </p>
              </div>
              <Badge
                variant={getPriorityVariant(item.priority)}
                className="shrink-0"
              >
                {item.priority}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {item.type === "MERGE_REQUEST" ? "MR" : item.type}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase">
                {getStateLabel(item.state)}
              </Badge>
              <span
                className={cn(
                  "text-[10px] font-medium uppercase",
                  getHealthClass(item.health),
                )}
              >
                {getHealthLabel(item.health)}
              </span>
              {item.labels.slice(0, 4).map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              ))}
              {item.lastActivityAt ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  Updated {formatRelativeDate(item.lastActivityAt)}
                </span>
              ) : null}
              {item.dueDate ? (
                <span
                  className={cn(
                    "text-xs",
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
