"use client";

import type { ReleaseEpicDetail } from "@/domain/types/releases";
import type { ReleaseStream } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkItemList } from "@/features/dashboard/components/work-item-list";
import { getHealthClass } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const STREAM_LABELS: Record<ReleaseStream, string> = {
  PRODUCT: "Product",
  OBSERVATIONS: "Observations",
  MOBILE: "Mobile",
};

export type ReleaseEpicOption = {
  epicIid: number;
  title: string;
  stream: ReleaseStream;
  monthKey: string;
  state: string;
};

export function ReleaseEpicCard({
  epic,
  epicOptions,
}: {
  epic: ReleaseEpicDetail;
  epicOptions: ReleaseEpicOption[];
}) {
  const router = useRouter();
  const checklistComplete = epic.checklist.filter(
    (item) => item.status === "complete",
  ).length;
  const [closing, setClosing] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moveTargets = epicOptions.filter(
    (option) =>
      option.epicIid !== epic.epicIid && option.state === "opened",
  );
  const isOpen = epic.state === "opened";

  async function handleCloseEpic() {
    if (!isOpen) return;
    const confirmed = window.confirm(
      `Close epic #${epic.epicIid} “${epic.title}” in GitLab?`,
    );
    if (!confirmed) return;

    setClosing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/releases/close-epic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epicId: epic.id }),
      });
      const payload = (await response.json()) as { error?: string; state?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to close epic");
      }
      setMessage(`Epic closed (${payload.state ?? "closed"})`);
      router.refresh();
    } catch (closeError) {
      setError(
        closeError instanceof Error ? closeError.message : "Failed to close epic",
      );
    } finally {
      setClosing(false);
    }
  }

  async function handleMoveIssue(workItemId: string, targetEpicIid: number) {
    setMovingId(workItemId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/releases/move-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workItemId, targetEpicIid }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to move issue");
      }
      const target = moveTargets.find((option) => option.epicIid === targetEpicIid);
      setMessage(
        target
          ? `Moved to ${STREAM_LABELS[target.stream]} · ${target.title}`
          : "Moved to target epic",
      );
      router.refresh();
    } catch (moveError) {
      setError(
        moveError instanceof Error ? moveError.message : "Failed to move issue",
      );
    } finally {
      setMovingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{epic.title}</CardTitle>
            <CardDescription>
              Epic #{epic.epicIid} · {STREAM_LABELS[epic.stream]}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isOpen ? <Badge variant="outline">Closed</Badge> : null}
            <Badge variant="outline" className={getHealthClass(epic.health)}>
              {epic.health.replace("_", " ")}
            </Badge>
            {epic.webUrl ? (
              <a
                href={epic.webUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                GitLab
                <ExternalLink className="ml-1 size-3" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOpen ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCloseEpic()}
              disabled={closing}
            >
              {closing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <XCircle />
              )}
              Close epic
            </Button>
          ) : null}
          {message ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {message}
            </span>
          ) : null}
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Planned" value={`${epic.plannedHours}h`} />
          <Metric label="Spent" value={`${epic.spentHours}h`} />
          <Metric
            label="Remaining"
            value={`${Math.max(0, Math.round((epic.plannedHours - epic.spentHours) * 10) / 10)}h`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {epic.doneItems} / {epic.totalItems} items complete
            </span>
            <span>{epic.progressPercent}%</span>
          </div>
          <Progress value={epic.progressPercent} />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{epic.openItems} open</Badge>
          {epic.blockedItems > 0 ? (
            <Badge variant="destructive">{epic.blockedItems} blocked</Badge>
          ) : null}
          {epic.inReviewItems > 0 ? (
            <Badge variant="secondary">{epic.inReviewItems} in review</Badge>
          ) : null}
          {epic.qaItems > 0 ? (
            <Badge variant="secondary">{epic.qaItems} in QA</Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Readiness checklist</p>
            <span className="text-xs text-muted-foreground">
              {checklistComplete}/{epic.checklist.length} complete
            </span>
          </div>
          <ul className="space-y-2">
            {epic.checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              >
                <ChecklistIcon status={item.status} />
                <div className="min-w-0">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Open work items</p>
          {epic.workItems.length === 0 ? (
            <WorkItemList
              items={[]}
              emptyMessage="No open items linked to this epic"
              compact
            />
          ) : (
            <div className="max-h-72 overflow-y-auto overscroll-contain divide-y rounded-lg border">
              {epic.workItems.map((item) => (
                <div key={item.id} className="space-y-2 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {item.webUrl ? (
                        <a
                          href={item.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <p className="truncate text-sm font-medium">{item.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.projectName}
                        {item.assigneeName ? ` · ${item.assigneeName}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {item.state.replace("_", " ")}
                    </Badge>
                  </div>

                  {moveTargets.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <label
                        className="sr-only"
                        htmlFor={`move-${item.id}`}
                      >
                        Move to epic
                      </label>
                      <select
                        id={`move-${item.id}`}
                        className={cn(
                          "h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                        defaultValue=""
                        disabled={movingId === item.id}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value) || value <= 0) return;
                          void handleMoveIssue(item.id, value);
                          event.target.value = "";
                        }}
                      >
                        <option value="" disabled>
                          Move to epic…
                        </option>
                        {moveTargets.map((option) => (
                          <option key={option.epicIid} value={option.epicIid}>
                            {STREAM_LABELS[option.stream]} · {option.title}
                          </option>
                        ))}
                      </select>
                      {movingId === item.id ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ChecklistIcon({
  status,
}: {
  status: ReleaseEpicDetail["checklist"][number]["status"];
}) {
  if (status === "complete") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  }

  if (status === "at_risk") {
    return (
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
    );
  }

  return (
    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
  );
}
