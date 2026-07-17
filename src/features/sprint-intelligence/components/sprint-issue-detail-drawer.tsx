"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSprintIssueEvaluation } from "@/features/sprint-intelligence/hooks/use-sprint-intelligence";
import {
  badgeClassForStatus,
  humanizeStatus,
} from "@/features/sprint-intelligence/lib/status-presentation";

export function SprintIssueDetailDrawer({
  open,
  onOpenChange,
  runId,
  evaluationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string | null;
  evaluationId: string | null;
}) {
  const detail = useSprintIssueEvaluation(runId, evaluationId);
  const evaluation = detail.data?.evaluation;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-lg"
        aria-describedby="si-issue-detail-desc"
      >
        <SheetHeader>
          <SheetTitle>
            {evaluation ? `#${evaluation.issueIid}` : "Issue detail"}
          </SheetTitle>
          <SheetDescription id="si-issue-detail-desc">
            Classification details for the selected issue evaluation.
          </SheetDescription>
        </SheetHeader>

        {detail.isLoading ? (
          <p className="px-4 text-sm text-muted-foreground">Loading…</p>
        ) : !evaluation ? (
          <p className="px-4 text-sm text-muted-foreground">
            Issue evaluation not found.
          </p>
        ) : (
          <div className="space-y-4 px-4 pb-6">
            <div>
              <p className="font-medium" title={evaluation.issueTitle}>
                {evaluation.issueTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Project {evaluation.projectId}
                {evaluation.issueWebUrl ? (
                  <>
                    {" · "}
                    <a
                      href={evaluation.issueWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Open in GitLab
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </>
                ) : null}
              </p>
            </div>

            {detail.data?.sprint ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sprint
                </h3>
                <p className="text-sm">{detail.data.sprint.milestoneTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {detail.data.sprint.startDate ?? "?"} →{" "}
                  {detail.data.sprint.dueDate ?? "?"} ({detail.data.sprint.timezone})
                </p>
              </section>
            ) : null}

            <section className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={badgeClassForStatus(evaluation.planningStatus)}
              >
                {humanizeStatus(evaluation.planningStatus)}
              </Badge>
              <Badge
                variant="outline"
                className={badgeClassForStatus(evaluation.deliveryStatus)}
              >
                {humanizeStatus(evaluation.deliveryStatus)}
              </Badge>
              {evaluation.excludedFromCommitment ? (
                <Badge variant="outline">Excluded from commitment</Badge>
              ) : null}
            </section>

            <section className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Assigned at</p>
                <p>
                  {evaluation.assignmentTimestamp
                    ? new Date(evaluation.assignmentTimestamp).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed at</p>
                <p>
                  {evaluation.completionTimestamp
                    ? new Date(evaluation.completionTimestamp).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Removal at</p>
                <p>
                  {evaluation.removalTimestamp
                    ? new Date(evaluation.removalTimestamp).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Work types</p>
                <p>{evaluation.workTypes.join(", ") || "—"}</p>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reason codes
              </h3>
              <ul className="space-y-2">
                {(detail.data?.reasonPresentations ?? []).map((reason) => (
                  <li
                    key={reason.code}
                    className="rounded-lg border border-border p-2 text-sm"
                  >
                    <p className="font-medium">{reason.title}</p>
                    <p className="text-xs text-muted-foreground">{reason.code}</p>
                    <p className="mt-1 text-muted-foreground">
                      {reason.explanation}
                    </p>
                    {reason.suggestedAction ? (
                      <p className="mt-1 text-xs">
                        Suggested action: {reason.suggestedAction}
                      </p>
                    ) : null}
                  </li>
                ))}
                {(detail.data?.reasonPresentations ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">None</li>
                ) : null}
              </ul>
            </section>

            <section className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Existing labels
                </h3>
                <p>{evaluation.existingLabels.join(", ") || "—"}</p>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended changes
                </h3>
                <p>
                  Add: {evaluation.recommendedLabelsToAdd.join(", ") || "—"}
                </p>
                <p>
                  Remove:{" "}
                  {evaluation.recommendedManagedLabelsToRemove.join(", ") ||
                    "—"}
                </p>
              </div>
            </section>

            {evaluation.evaluationErrorCode ? (
              <section className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
                <p className="font-medium">{evaluation.evaluationErrorCode}</p>
                <p className="mt-1">
                  {evaluation.evaluationErrorMessage ??
                    "Evaluation reported an error."}
                </p>
              </section>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
