"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  GitBranch,
  GitPullRequest,
  Loader2,
  Search,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GitLabActivityResult } from "@/domain/types/gitlab-activity";
import type { GitLabStatus } from "@/domain/types/gitlab";
import { GitLabActivityTable } from "@/features/gitlab/components/gitlab-activity-table";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type TypeFilter = "ALL" | "ISSUE" | "MERGE_REQUEST";
type StateFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "QA";

interface GitLabActivityViewProps {
  initialStatus: GitLabStatus | null;
}

async function fetchActivity(params: URLSearchParams): Promise<GitLabActivityResult> {
  const response = await fetch(`/api/gitlab/activity?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load GitLab activity");
  }
  return response.json();
}

export function GitLabActivityView({ initialStatus }: GitLabActivityViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "50");
  if (typeFilter !== "ALL") params.set("type", typeFilter);
  if (stateFilter !== "ALL") params.set("state", stateFilter);
  if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
  if (projectFilter !== "ALL") params.set("projectId", projectFilter);
  if (search) params.set("search", search);

  const activityQuery = useQuery({
    queryKey: [
      "gitlab-activity",
      typeFilter,
      stateFilter,
      priorityFilter,
      projectFilter,
      search,
      page,
    ],
    queryFn: () => fetchActivity(params),
  });

  const data = activityQuery.data;
  const status = initialStatus;
  const lastSync = status?.lastSync;
  const scheduler = status?.scheduler;
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <>
      <AppHeader
        title="GitLab Activity"
        description="Synced issues and merge requests from your GitLab group"
        actions={
          <Button variant="outline" size="sm" render={<Link href="/settings" />}>
            <GitBranch />
            Manage sync
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Synced items"
            value={data?.stats.total ?? "—"}
            icon={<GitBranch className="size-4" />}
          />
          <StatCard
            label="Issues"
            value={data?.stats.issues ?? "—"}
            icon={<AlertTriangle className="size-4" />}
          />
          <StatCard
            label="Merge requests"
            value={data?.stats.mergeRequests ?? "—"}
            icon={<GitPullRequest className="size-4" />}
          />
          <StatCard
            label="Blocked"
            value={data?.stats.blocked ?? "—"}
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            highlight={Boolean(data && data.stats.blocked > 0)}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sync</CardTitle>
            <CardDescription>
              {status?.configured
                ? `Background sync every ${scheduler?.intervalMinutes ?? 15} minutes when the worker is running.`
                : "Configure GitLab in Settings to enable sync."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            {lastSync ? (
              <>
                <Badge
                  variant={
                    lastSync.status === "completed"
                      ? "secondary"
                      : lastSync.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {lastSync.status}
                </Badge>
                <span className="text-muted-foreground">
                  Last sync {formatRelativeDate(lastSync.startedAt)}
                  {lastSync.itemsCount > 0
                    ? ` · ${lastSync.itemsCount} items`
                    : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No sync runs yet</span>
            )}
            {scheduler?.scheduled && scheduler.nextRunAt ? (
              <span className="text-muted-foreground">
                Next {formatRelativeDate(scheduler.nextRunAt)}
              </span>
            ) : null}
            {!scheduler?.redisAvailable ? (
              <Badge variant="outline">Redis offline</Badge>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Work items</CardTitle>
              <CardDescription>
                {data
                  ? `${data.total} items match your filters`
                  : "Loading synced work items…"}
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative max-w-md">
                <Search
                  className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search title or labels…"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Tabs
                  value={typeFilter}
                  onValueChange={(value) => {
                    setTypeFilter(value as TypeFilter);
                    setPage(1);
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="ALL">All</TabsTrigger>
                    <TabsTrigger value="ISSUE">Issues</TabsTrigger>
                    <TabsTrigger value="MERGE_REQUEST">MRs</TabsTrigger>
                  </TabsList>
                </Tabs>

                <FilterSelect
                  label="State"
                  value={stateFilter}
                  onChange={(value) => {
                    setStateFilter(value as StateFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All states" },
                    { value: "OPEN", label: "Open" },
                    { value: "IN_PROGRESS", label: "In progress" },
                    { value: "IN_REVIEW", label: "In review" },
                    { value: "BLOCKED", label: "Blocked" },
                    { value: "QA", label: "QA" },
                  ]}
                />

                <FilterSelect
                  label="Priority"
                  value={priorityFilter}
                  onChange={(value) => {
                    setPriorityFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All priorities" },
                    { value: "CRITICAL", label: "Critical" },
                    { value: "HIGH", label: "High" },
                    { value: "MEDIUM", label: "Medium" },
                    { value: "LOW", label: "Low" },
                  ]}
                />

                {data?.projects.length ? (
                  <FilterSelect
                    label="Project"
                    value={projectFilter}
                    onChange={(value) => {
                      setProjectFilter(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "ALL", label: "All projects" },
                      ...data.projects.map((project) => ({
                        value: project.id,
                        label: `${project.name} (${project.count})`,
                      })),
                    ]}
                  />
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {activityQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading activity…
              </div>
            ) : activityQuery.isError ? (
              <div className="p-8 text-sm text-destructive">
                {(activityQuery.error as Error).message}
              </div>
            ) : data ? (
              <>
                <GitLabActivityTable items={data.items} />
                {totalPages > 1 ? (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Page {data.page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3 pt-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight",
              highlight && "text-amber-600 dark:text-amber-400",
            )}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
