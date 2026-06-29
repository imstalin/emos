import type { ProductBacklogItem } from "@/domain/types/product-backlog";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatRelativeDate,
  getHealthClass,
  getHealthLabel,
  getPriorityVariant,
  getStateLabel,
  isOverdue,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface ProductBacklogTableProps {
  items: ProductBacklogItem[];
  emptyMessage?: string;
}

export function ProductBacklogTable({
  items,
  emptyMessage = "No items",
}: ProductBacklogTableProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="p-0">
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
                          className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
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
                      {item.assigneeName ? ` · ${item.assigneeName}` : " · Unassigned"}
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
                    {getStateLabel(item.state)}
                  </Badge>
                  {item.typeLabel ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Type::{item.typeLabel}
                    </Badge>
                  ) : null}
                  {item.milestoneTitle ? (
                    <Badge variant="outline" className="text-[10px]">
                      {item.milestoneTitle}
                    </Badge>
                  ) : null}
                  {item.storyPoints != null ? (
                    <Badge variant="outline" className="text-[10px]">
                      {item.storyPoints} pts
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase",
                      getHealthClass(item.health),
                    )}
                  >
                    {getHealthLabel(item.health)}
                  </span>
                  {item.labels
                    .filter((label) => !/^type::/i.test(label))
                    .slice(0, 4)
                    .map((label) => (
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
      </CardContent>
    </Card>
  );
}
