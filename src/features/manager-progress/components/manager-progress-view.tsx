"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCopy, RefreshCw } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchDsmView,
  fetchWorkItemDetail,
} from "@/features/manager-progress/api/manager-progress-client";
import { EvidenceDrawer } from "@/features/manager-progress/components/evidence-drawer";
import { ProgressSections } from "@/features/manager-progress/components/progress-sections";
import { ProgressTable } from "@/features/manager-progress/components/progress-table";
import { useFeedHealth, useManagerProgress } from "@/features/manager-progress/hooks/use-manager-progress";
import { formatRelativeDate } from "@/lib/formatters";

export function ManagerProgressView() {
  const [date, setDate] = useState("");
  const [teamId, setTeamId] = useState("");
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters = useMemo(
    () => ({
      date: date || undefined,
      teamId: teamId || undefined,
    }),
    [date, teamId],
  );

  const progressQuery = useManagerProgress(filters);
  const feedHealthQuery = useFeedHealth();

  const detailQuery = useQuery({
    queryKey: ["work-item-detail", selectedWorkItemId],
    queryFn: () => fetchWorkItemDetail(selectedWorkItemId!),
    enabled: Boolean(selectedWorkItemId),
  });

  const dsmQuery = useQuery({
    queryKey: ["manager-dsm", date],
    queryFn: () => fetchDsmView(date || undefined),
    enabled: false,
  });

  const handleSelectWorkItem = useCallback((workItemId: string) => {
    setSelectedWorkItemId(workItemId);
    setDrawerOpen(true);
  }, []);

  const data = progressQuery.data;

  const copyDsmMarkdown = async () => {
    const result = await dsmQuery.refetch();
    const rows = result.data?.rows ?? [];
    const markdown = rows
      .map(
        (row) =>
          `### ${row.ownerName}\n**${row.priorityName}**\n\nYesterday: ${row.yesterdayMovement}\n\nToday: ${row.todayMilestone}\n\nBlocker: ${row.blocker ?? "None"}\n\nTarget: ${row.targetDate ? formatRelativeDate(row.targetDate) : "—"}`,
      )
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(markdown);
  };

  return (
    <>
      <AppHeader
        title="Engineering Progress"
        description={
          data
            ? `Manager dashboard · ${data.summary.date} · Updated ${formatRelativeDate(data.generatedAt)}`
            : "Manager dashboard"
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => progressQuery.refetch()}
            disabled={progressQuery.isFetching}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {data?.feedHealthWarning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Feed data may be stale or unavailable</p>
              <p className="text-muted-foreground">
                Do not infer &quot;no work happened&quot; from feed failures. Check feed health.
              </p>
            </div>
          </div>
        )}

        {progressQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading progress dashboard…</p>
        )}

        {progressQuery.isError && (
          <p className="text-sm text-destructive">
            {(progressQuery.error as Error).message}
          </p>
        )}

        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Overall</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>{data.summary.overall.prioritiesMoved} priorities moved forward</p>
                  <p>{data.summary.overall.prioritiesBlocked} blocked</p>
                  <p>{data.summary.overall.releaseReadyCount} release-ready</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Major Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 list-disc pl-4">
                    {data.summary.majorProgress.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Manager Attention</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 list-disc pl-4">
                    {data.summary.managerAttention.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

            <section className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Team</label>
                <select
                  className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 text-sm"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  <option value="">All teams</option>
                  {data.filters.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="table">Main Table</TabsTrigger>
                <TabsTrigger value="dsm">DSM</TabsTrigger>
                <TabsTrigger value="feeds">Feed Health</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <ProgressSections
                  sections={data.sections}
                  onSelectWorkItem={handleSelectWorkItem}
                />
              </TabsContent>

              <TabsContent value="table" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <ProgressTable
                      rows={data.mainTable}
                      onSelect={handleSelectWorkItem}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dsm" className="mt-4 space-y-3">
                <Button variant="outline" size="sm" onClick={() => void copyDsmMarkdown()}>
                  <ClipboardCopy className="size-4" />
                  Copy as Markdown
                </Button>
                <Card>
                  <CardContent className="pt-6 text-sm space-y-4">
                    {(dsmQuery.data?.rows ?? []).map((row, index) => (
                      <div key={`${row.ownerName}-${index}`} className="border-b pb-3">
                        <p className="font-medium">{row.ownerName}</p>
                        <p>{row.priorityName}</p>
                        <p className="text-muted-foreground">Yesterday: {row.yesterdayMovement}</p>
                        <p>Today: {row.todayMilestone}</p>
                        <p>Blocker: {row.blocker ?? "None"}</p>
                      </div>
                    ))}
                    {!dsmQuery.data && (
                      <Button variant="secondary" size="sm" onClick={() => dsmQuery.refetch()}>
                        Load DSM view
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="feeds" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      {(feedHealthQuery.data?.health ?? []).map((feed) => (
                        <div
                          key={feed.memberName}
                          className="flex items-center justify-between text-sm border-b py-2"
                        >
                          <span>{feed.memberName}</span>
                          <Badge
                            variant={
                              feed.status === "healthy" ? "secondary" : "destructive"
                            }
                          >
                            {feed.status}
                          </Badge>
                        </div>
                      ))}
                      {feedHealthQuery.isLoading && (
                        <p className="text-muted-foreground text-sm">Loading feed health…</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <EvidenceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        detail={detailQuery.data ?? null}
        isLoading={detailQuery.isLoading}
      />
    </>
  );
}
