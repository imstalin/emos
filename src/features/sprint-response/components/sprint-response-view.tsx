"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  UserRoundX,
} from "lucide-react";
import { useMemo, useState } from "react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  SprintResponseDeveloperNudge,
  SprintResponseIssue,
  SprintResponseSummary,
} from "@/domain/types/sprint-response";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface SprintResponseViewProps {
  configured: boolean;
}

type ViewTab = "nudge" | "unanswered" | "status";

async function fetchSummary(milestone?: string): Promise<SprintResponseSummary> {
  const params = new URLSearchParams();
  if (milestone) params.set("milestone", milestone);
  const response = await fetch(`/api/sprints/response?${params.toString()}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load sprint response summary");
  }
  return response.json();
}

export function SprintResponseView({ configured }: SprintResponseViewProps) {
  const [milestone, setMilestone] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<ViewTab>("nudge");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["sprint-response", milestone ?? "default"],
    queryFn: () => fetchSummary(milestone),
    enabled: configured,
    staleTime: 120_000,
    gcTime: 300_000,
    retry: 1,
  });

  const data = query.data;

  const milestoneOptions = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.filter((m) => m.state === "active").slice(0, 24);
  }, [data?.milestones]);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }

  if (!configured) {
    return (
      <>
        <AppHeader
          title="Sprint Response"
          description="Track developer replies on sprint milestone issues"
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="size-5 text-amber-500" />
                GitLab not configured
              </CardTitle>
              <CardDescription>
                Set GITLAB_URL, GITLAB_TOKEN, and GITLAB_GROUP_ID to load sprint
                response data.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Sprint Response"
        description={
          data?.milestone
            ? `${data.milestone.title} · developer reply coverage`
            : "Developer reply coverage for the active sprint milestone"
        }
        actions={
          <div className="flex items-center gap-2">
            {data?.boardUrl ? (
              <Button variant="outline" size="sm" render={<a href={data.boardUrl} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="size-3.5" />
                Board
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Milestone</span>
            <select
              className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm"
              value={data?.milestone?.title ?? milestone ?? ""}
              onChange={(event) => {
                const value = event.target.value || undefined;
                setMilestone(value);
              }}
              disabled={query.isLoading && !data}
            >
              {milestoneOptions.length === 0 ? (
                <option value="">Loading milestones…</option>
              ) : (
                milestoneOptions.map((option) => (
                  <option key={option.id} value={option.title}>
                    {option.title}
                    {option.dueDate ? ` (due ${option.dueDate})` : ""}
                  </option>
                ))
              )}
            </select>
          </label>
          {data ? (
            <p className="text-xs text-muted-foreground">
              Updated {formatRelativeDate(data.generatedAt)}
            </p>
          ) : null}
        </div>

        {query.isLoading && !data ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Scanning milestone issues and comments…
            <span className="text-xs">This can take up to a minute.</span>
          </div>
        ) : null}

        {query.isError ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {query.error instanceof Error
                ? query.error.message
                : "Failed to load sprint responses"}
            </CardContent>
          </Card>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total issues" value={data.totalIssues} />
              <StatCard
                label="With response"
                value={data.withDeveloperResponse}
                hint={`${data.responseRate}% coverage`}
              />
              <StatCard
                label="Need nudge"
                value={data.withoutDeveloperResponse}
                highlight={data.withoutDeveloperResponse > 0}
              />
              <StatCard
                label="Developers to nudge"
                value={data.developersToNudge.length}
                highlight={data.developersToNudge.length > 0}
              />
            </div>

            <Card>
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle>Response follow-up</CardTitle>
                  <CardDescription>
                    Issues without a non-system comment from an assignee or
                    another developer (not the issue author)
                  </CardDescription>
                </div>
                <Tabs
                  value={tab}
                  onValueChange={(value) => setTab(value as ViewTab)}
                >
                  <TabsList className="flex h-auto flex-wrap">
                    <TabsTrigger value="nudge">
                      Nudge list ({data.developersToNudge.length})
                    </TabsTrigger>
                    <TabsTrigger value="unanswered">
                      Unanswered ({data.unansweredIssues.length})
                    </TabsTrigger>
                    <TabsTrigger value="status">
                      By status ({data.byStatus.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>

              <CardContent className="p-0">
                {tab === "nudge" ? (
                  <NudgeList
                    developers={data.developersToNudge}
                    fullyResponded={data.fullyRespondedDevelopers}
                    unassigned={data.unassignedUnanswered}
                    copiedKey={copiedKey}
                    onCopy={copyText}
                  />
                ) : null}
                {tab === "unanswered" ? (
                  <IssueList issues={data.unansweredIssues} empty="All issues have a developer response." />
                ) : null}
                {tab === "status" ? (
                  <StatusBreakdown rows={data.byStatus} />
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight",
            highlight && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NudgeList({
  developers,
  fullyResponded,
  unassigned,
  copiedKey,
  onCopy,
}: {
  developers: SprintResponseDeveloperNudge[];
  fullyResponded: SprintResponseSummary["fullyRespondedDevelopers"];
  unassigned: SprintResponseIssue[];
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  if (developers.length === 0 && unassigned.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-500" />
        Everyone assigned has a developer response on their issues.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {developers.map((dev, index) => (
        <div key={dev.username} className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">#{index + 1}</Badge>
                <p className="text-sm font-medium">
                  @{dev.username}
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {dev.name}
                  </span>
                </p>
                <Badge variant="secondary">
                  {dev.unansweredCount} unanswered
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dev.respondedCount}/{dev.assignedCount} responded
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(dev.username, dev.nudgeMessage)}
            >
              {copiedKey === dev.username ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiedKey === dev.username ? "Copied" : "Copy nudge"}
            </Button>
          </div>

          <ul className="space-y-2">
            {dev.unansweredIssues.map((issue) => (
              <IssueRow key={`${issue.projectId}-${issue.iid}`} issue={issue} compact />
            ))}
          </ul>

          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
            {dev.nudgeMessage}
          </pre>
        </div>
      ))}

      {unassigned.length > 0 ? (
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserRoundX className="size-4 text-amber-500" />
            Unassigned ({unassigned.length})
          </div>
          <ul className="space-y-2">
            {unassigned.map((issue) => (
              <IssueRow key={`${issue.projectId}-${issue.iid}`} issue={issue} />
            ))}
          </ul>
        </div>
      ) : null}

      {fullyResponded.length > 0 ? (
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm font-medium text-muted-foreground">
            Fully responded
          </p>
          <div className="flex flex-wrap gap-2">
            {fullyResponded.map((dev) => (
              <Badge key={dev.username} variant="outline">
                @{dev.username} · {dev.assignedCount}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IssueList({
  issues,
  empty,
}: {
  issues: SprintResponseIssue[];
  empty: string;
}) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <MessageSquareWarning className="size-4" />
        {empty}
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {issues.map((issue) => (
        <li key={`${issue.projectId}-${issue.iid}`} className="px-4 py-3">
          <IssueRow issue={issue} />
        </li>
      ))}
    </ul>
  );
}

function IssueRow({
  issue,
  compact,
}: {
  issue: SprintResponseIssue;
  compact?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", !compact && "hover:bg-transparent")}>
      <div className="flex flex-wrap items-center gap-2">
        {issue.statusLabel ? (
          <Badge variant="secondary">{issue.statusLabel}</Badge>
        ) : (
          <Badge variant="outline">No status</Badge>
        )}
        {issue.typeLabel ? (
          <Badge variant="outline">{issue.typeLabel}</Badge>
        ) : null}
        <a
          href={issue.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm font-medium hover:underline"
        >
          #{issue.iid} {issue.title}
        </a>
        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">
        {issue.assignees.length > 0
          ? issue.assignees.map((a) => `@${a.username}`).join(", ")
          : "Unassigned"}
        {" · "}
        {issue.state}
      </p>
    </div>
  );
}

function StatusBreakdown({
  rows,
}: {
  rows: SprintResponseSummary["byStatus"];
}) {
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        No status data.
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li
          key={row.status}
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <span className="font-medium">{row.status}</span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{row.total} total</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {row.responded} responded
            </span>
            <span
              className={cn(
                row.unanswered > 0 && "text-amber-600 dark:text-amber-400",
              )}
            >
              {row.unanswered} unanswered
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
