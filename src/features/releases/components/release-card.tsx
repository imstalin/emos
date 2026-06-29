import type { ReleaseDetail } from "@/domain/types/releases";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

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
import { formatRelativeDate, getHealthClass } from "@/lib/formatters";

export function ReleaseCard({ release }: { release: ReleaseDetail }) {
  const checklistComplete = release.checklist.filter(
    (item) => item.status === "complete",
  ).length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>
              v{release.version}
              {release.name ? ` — ${release.name}` : ""}
            </CardTitle>
            <CardDescription>{release.projectName}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {release.isDraft ? (
              <Badge variant="outline">Draft</Badge>
            ) : null}
            <Badge variant="outline" className={getHealthClass(release.health)}>
              {release.health.replace("_", " ")}
            </Badge>
          </div>
        </div>

        {release.description ? (
          <p className="text-sm text-muted-foreground">{release.description}</p>
        ) : null}

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {release.doneItems} / {release.totalItems} items complete
            </span>
            <span>{release.progressPercent}%</span>
          </div>
          <Progress value={release.progressPercent} />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{release.openItems} open</Badge>
          {release.blockedItems > 0 ? (
            <Badge variant="destructive">{release.blockedItems} blocked</Badge>
          ) : null}
          {release.inReviewItems > 0 ? (
            <Badge variant="secondary">{release.inReviewItems} in review</Badge>
          ) : null}
          {release.qaItems > 0 ? (
            <Badge variant="secondary">{release.qaItems} in QA</Badge>
          ) : null}
          {release.targetDate ? (
            <span className="text-muted-foreground">
              Target {formatRelativeDate(release.targetDate)}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Readiness checklist</p>
            <span className="text-xs text-muted-foreground">
              {checklistComplete}/{release.checklist.length} complete
            </span>
          </div>
          <ul className="space-y-2">
            {release.checklist.map((item) => (
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
            items={release.workItems}
            emptyMessage="No open items for this release scope"
            compact
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistIcon({
  status,
}: {
  status: ReleaseDetail["checklist"][number]["status"];
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
