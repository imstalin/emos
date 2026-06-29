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
import { formatRelativeDate } from "@/lib/formatters";

interface ReleasesViewProps {
  data: ReleasesDashboard;
}

export function ReleasesView({ data }: ReleasesViewProps) {
  return (
    <>
      <AppHeader
        title="Release Management"
        description={`Delivery readiness · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <Badge variant="outline" className="gap-1">
            <Rocket className="size-3" />
            {data.releases.length} active releases
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Upcoming" value={data.summary.upcoming} />
          <SummaryCard label="Draft" value={data.summary.draft} />
          <SummaryCard
            label="At risk"
            value={data.summary.atRisk}
            highlight={data.summary.atRisk > 0}
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

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Releases</h2>
            <p className="text-sm text-muted-foreground">
              Readiness checklists and open work scoped to each release
            </p>
          </div>

          {data.releases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No unreleased versions configured. Add releases in the database
                or seed data.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.releases.map((release) => (
                <ReleaseCard key={release.id} release={release} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
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
        </p>
      </CardContent>
    </Card>
  );
}
