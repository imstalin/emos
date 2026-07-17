"use client";

import { Badge } from "@/components/ui/badge";
import { useSprintFailures } from "@/features/sprint-intelligence/hooks/use-sprint-intelligence";

export function SprintFailuresTable({
  runId,
  enabled,
}: {
  runId: string | null;
  enabled: boolean;
}) {
  const query = useSprintFailures(runId, enabled);

  if (!runId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a run to inspect failures.
      </p>
    );
  }

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading failures…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {(query.error as Error).message}
      </p>
    );
  }

  const data = query.data;
  if (!data) return null;

  const issueFailures = data.issueFailures ?? [];
  const actionFailures = data.actionFailures ?? [];

  return (
    <div className="space-y-4">
      {(data.runErrorCode || data.runErrorMessage) && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
          <p className="font-medium">
            Run {data.runStatus}
            {data.runErrorCode ? `: ${data.runErrorCode}` : ""}
          </p>
          {data.runErrorMessage ? <p className="mt-1">{data.runErrorMessage}</p> : null}
        </div>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">
          Issue-level failures ({issueFailures.length})
        </h3>
        {issueFailures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issue failures.</p>
        ) : (
          <ul className="space-y-2">
            {issueFailures.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Issue</Badge>
                  <span className="font-mono text-xs">
                    #{item.issueIid} · project {item.projectId}
                  </span>
                  {item.evaluationErrorCode ? (
                    <Badge variant="outline">{item.evaluationErrorCode}</Badge>
                  ) : null}
                </div>
                <p className="mt-1">{item.issueTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.evaluationErrorMessage ??
                    item.reasons[0]?.explanation ??
                    "Unable to determine classification."}
                </p>
                {item.reasons[0]?.suggestedAction ? (
                  <p className="mt-1 text-xs">
                    Next action: {item.reasons[0].suggestedAction}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suggested next actions: check milestone history, verify GitLab
                    token access, verify milestone mapping, or re-run analysis.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">
          Label action failures ({actionFailures.length})
        </h3>
        {actionFailures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No label-action failures.</p>
        ) : (
          <ul className="space-y-2">
            {actionFailures.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <span className="font-mono text-xs">
                    #{item.issueIid} · {item.action} {item.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.errorMessage ?? item.errorCode ?? "Label mutation failed."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
