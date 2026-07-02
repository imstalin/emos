import { Rocket } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReleasesDashboard } from "@/domain/types/releases";
import { SprintHealthCard } from "@/features/dashboard/components/health-cards";
import { WorkItemList } from "@/features/dashboard/components/work-item-list";
import { ReleaseCard } from "@/features/releases/components/release-card";
import { ReleaseEpicCard } from "@/features/releases/components/release-epic-card";
import { ReleaseEpicSyncButton } from "@/features/releases/components/release-epic-sync-button";
import { formatRelativeDate, getHealthClass } from "@/lib/formatters";

interface ReleasesViewProps {
  data: ReleasesDashboard;
}

export function ReleasesView({ data }: ReleasesViewProps) {
  const hasMonthlyReleases = data.monthlyReleases.length > 0;
  const openEpicCount = data.summary.openEpics || data.summary.upcoming;

  return (
    <>
      <AppHeader
        title="Release Management"
        description={`Monthly release epics · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ReleaseEpicSyncButton />
            <Badge variant="outline" className="gap-1">
              <Rocket className="size-3" />
              {openEpicCount} open epics
            </Badge>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Active months" value={data.summary.activeMonths} />
          <SummaryCard label="Open epics" value={data.summary.openEpics} />
          <SummaryCard
            label="At risk"
            value={data.summary.atRisk}
            highlight={data.summary.atRisk > 0}
          />
          <SummaryCard
            label="Planned hours"
            value={data.summary.totalPlannedHours}
            suffix="h"
          />
          <SummaryCard
            label="Spent hours"
            value={data.summary.totalSpentHours}
            suffix="h"
          />
        </div>

        {data.activeSprint ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active sprint</CardTitle>
              <CardDescription>
                Current sprint scope and delivery progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <SprintHealthCard sprint={data.activeSprint} />
              {data.sprintWorkItems.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Sprint work items</p>
                  <WorkItemList
                    items={data.sprintWorkItems}
                    emptyMessage="No active sprint items"
                    compact
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {hasMonthlyReleases ? (
          <div className="space-y-6">
            {data.monthlyReleases.map((group) => (
              <section key={group.monthKey} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      {group.label} Release
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Product, Observations, and Mobile epics with effort rollups
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className={getHealthClass(group.health)}>
                      {group.health.replace("_", " ")}
                    </Badge>
                    <span className="text-muted-foreground">
                      {group.totalSpentHours}h / {group.totalPlannedHours}h ·{" "}
                      {group.progressPercent}% complete
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {group.epics.map((epic) => (
                    <ReleaseEpicCard key={epic.id} epic={epic} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {!hasMonthlyReleases && data.releases.length > 0 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Version releases
              </h2>
              <p className="text-sm text-muted-foreground">
                Legacy version-scoped releases (sync monthly epics to replace this view)
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {data.releases.map((release) => (
                <ReleaseCard key={release.id} release={release} />
              ))}
            </div>
          </div>
        ) : null}

        {!hasMonthlyReleases && data.releases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No monthly release epics synced yet. Click{" "}
              <strong>Sync release epics</strong> to pull Phoenix group epics like
              &quot;June Product Release - 2026&quot;.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  suffix = "",
  highlight = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            highlight
              ? "text-2xl font-semibold text-amber-600 dark:text-amber-400"
              : "text-2xl font-semibold"
          }
        >
          {value}
          {suffix}
        </p>
      </CardContent>
    </Card>
  );
}
