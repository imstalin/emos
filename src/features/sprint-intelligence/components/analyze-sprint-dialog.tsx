"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SprintIntelligenceMilestone } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function AnalyzeSprintDialog({
  open,
  onOpenChange,
  milestone,
  timezone,
  allowFirstDayAdditions,
  dryRunOnly,
  projectCount,
  isSubmitting,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: SprintIntelligenceMilestone | null;
  timezone: string;
  allowFirstDayAdditions: boolean;
  dryRunOnly: boolean;
  projectCount: number;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Analyze Sprint</SheetTitle>
          <SheetDescription>
            Confirm the sprint analysis request before it is queued.
          </SheetDescription>
        </SheetHeader>
        {milestone ? (
          <div className="space-y-3 px-4 text-sm">
            <dl className="space-y-2">
              <div>
                <dt className="text-muted-foreground">Sprint</dt>
                <dd className="font-medium">{milestone.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dates</dt>
                <dd>
                  {milestone.startDate} → {milestone.dueDate}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Projects</dt>
                <dd>{projectCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Timezone</dt>
                <dd>{timezone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">First-day planning</dt>
                <dd>
                  {allowFirstDayAdditions
                    ? "Additions on the first day count as planned"
                    : "First-day additions are unplanned"}
                </dd>
              </div>
            </dl>
            <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              {dryRunOnly
                ? "This is a dry-run analysis. No GitLab labels will be changed."
                : "This analysis will classify issues and recommend label changes. Apply remains a separate confirmed step."}
            </p>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!milestone || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Starting…" : "Start analysis"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
