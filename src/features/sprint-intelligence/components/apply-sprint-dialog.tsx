"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { shortRunId } from "@/features/sprint-intelligence/lib/status-presentation";
import type { SprintRunDetail } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function ApplySprintDialog({
  open,
  onOpenChange,
  run,
  isSubmitting,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: SprintRunDetail | null;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const eligibility = run?.actionEligibility;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmed(false);
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Apply Label Changes</SheetTitle>
          <SheetDescription>
            This will update GitLab issue labels for the selected analysis.
          </SheetDescription>
        </SheetHeader>
        {run ? (
          <div className="space-y-3 px-4 text-sm">
            <dl className="space-y-2">
              <div>
                <dt className="text-muted-foreground">Sprint</dt>
                <dd className="font-medium">{run.milestoneTitle}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source analysis</dt>
                <dd className="font-mono text-xs">{shortRunId(run.id)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Issues affected</dt>
                <dd>{run.evaluationCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Labels to add</dt>
                <dd>{eligibility?.actionableAdds ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Labels to remove</dt>
                <dd>{eligibility?.actionableRemoves ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Skipped / failed evaluations</dt>
                <dd>{run.failureCount}</dd>
              </div>
            </dl>
            <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
              Warning: GitLab issues will be changed. Label plans are taken only
              from the persisted analysis run.
            </p>
            <label className="flex items-start gap-2 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I understand that this will update GitLab labels.
              </span>
            </label>
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
            variant="destructive"
            onClick={onConfirm}
            disabled={!run || !confirmed || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Applying…" : "Apply label changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
