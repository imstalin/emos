"use client";

import type { WorkItemDetailView } from "@/domain/types/manager-progress";
import { progressIndicatorLabel } from "@/domain/manager-progress/progress-detector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/formatters";

interface EvidenceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: WorkItemDetailView | null;
  isLoading?: boolean;
}

export function EvidenceDrawer({
  open,
  onOpenChange,
  detail,
  isLoading,
}: EvidenceDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {detail?.workItem.title ?? "Work item evidence"}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground mt-4">Loading evidence…</p>
        )}

        {detail && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{detail.workItem.stageLabel}</Badge>
              <Badge variant="secondary">
                {progressIndicatorLabel(detail.workItem.progressToday)}
              </Badge>
            </div>

            {detail.workItem.blocker && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                {detail.workItem.blocker}
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Evidence</h4>
              <ul className="space-y-3">
                {detail.evidence.map((item) => (
                  <li key={item.id} className="text-sm border-l-2 pl-3">
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeDate(item.timestamp)} · {item.memberName}
                    </p>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p>{item.title}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {detail.blockers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Blockers</h4>
                <ul className="space-y-2 text-sm">
                  {detail.blockers.map((blocker) => (
                    <li key={blocker.id}>
                      {blocker.isConfirmed ? "" : "Possible blocker: "}
                      {blocker.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
