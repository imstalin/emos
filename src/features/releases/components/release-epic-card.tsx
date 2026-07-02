import type { ReleaseEpicDetail } from "@/domain/types/releases";
import type { ReleaseStream } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

const STREAM_LABELS: Record<ReleaseStream, string> = {
  PRODUCT: "Product",
  OBSERVATIONS: "Observations",
  MOBILE: "Mobile",
};

export function ReleaseEpicCard({ epic }: { epic: ReleaseEpicDetail }) {
  const checklistComplete = epic.checklist.filter(
    (item) => item.status === "complete",
  ).length;

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
            {epic.state !== "opened" ? (
              <Badge variant="outline">Closed</Badge>
            ) : null}
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
          <WorkItemList
            items={epic.workItems}
            emptyMessage="No open items linked to this epic"
            compact
          />
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
