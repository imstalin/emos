"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  Unplug,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GitLabStatus, SyncResult } from "@/domain/types/gitlab";
import { formatRelativeDate } from "@/lib/formatters";

type GitLabStatusResponse = GitLabStatus & {
  connection?: {
    ok: boolean;
    user?: { username: string; name: string };
    group?: { full_path: string };
    error?: string;
  };
  error?: string;
};

async function fetchStatus(): Promise<GitLabStatusResponse> {
  const response = await fetch("/api/gitlab/status");
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? "Failed to load GitLab status");
  }
  return response.json();
}

async function testConnection() {
  const response = await fetch("/api/gitlab/test", { method: "POST" });
  return response.json();
}

async function runSync(): Promise<SyncResult> {
  const response = await fetch("/api/gitlab/sync", { method: "POST" });
  const body = (await response.json()) as SyncResult & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Sync failed");
  }
  return body;
}

export function GitLabIntegrationPanel() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["gitlab-status"],
    queryFn: fetchStatus,
  });

  const testMutation = useMutation({
    mutationFn: testConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gitlab-status"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: runSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gitlab-status"] });
    },
  });

  const status = statusQuery.data;
  const connection = status?.connection;
  const lastSync = status?.lastSync;
  const scheduler = status?.scheduler;
  const webhook = status?.webhook;
  const isSyncing = syncMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitLab Integration</CardTitle>
        <CardDescription>
          Sync issues and merge requests from your GitLab group into EMOS.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {statusQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading configuration…
          </div>
        ) : statusQuery.isError ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {(statusQuery.error as Error).message}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfigRow label="GitLab URL" value={status?.gitlabUrl ?? "—"} />
              <ConfigRow label="Group ID" value={status?.groupId ?? "—"} />
            </div>

            {status?.monitoredProjects && status.monitoredProjects.length > 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Monitored projects</p>
                <p className="mt-1 text-muted-foreground">
                  Sync and dashboards are limited to these GitLab project IDs.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {status.monitoredProjects.map((project) => (
                    <Badge key={project.gitlabId} variant="secondary">
                      {project.name} ({project.gitlabId})
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Connection</span>
              {connection?.ok ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  {connection.user?.username ?? "Connected"}
                </Badge>
              ) : connection?.error ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="size-3" />
                  Failed
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Unplug className="size-3" />
                  Not tested
                </Badge>
              )}
              {connection?.group?.full_path ? (
                <span className="text-xs text-muted-foreground">
                  Group: {connection.group.full_path}
                </span>
              ) : null}
            </div>

            {connection?.error ? (
              <p className="text-sm text-destructive">{connection.error}</p>
            ) : null}

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="font-medium">Background sync</span>
                {scheduler?.redisAvailable && scheduler.scheduled ? (
                  <Badge variant="secondary">Every {scheduler.intervalMinutes}m</Badge>
                ) : scheduler?.redisAvailable ? (
                  <Badge variant="outline">Scheduler not registered</Badge>
                ) : (
                  <Badge variant="outline">Redis offline</Badge>
                )}
              </div>
              {scheduler?.redisAvailable ? (
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {scheduler.nextRunAt ? (
                    <p>Next run {formatRelativeDate(scheduler.nextRunAt)}</p>
                  ) : null}
                  {(scheduler.queueActive > 0 || scheduler.queueWaiting > 0) && (
                    <p>
                      Queue: {scheduler.queueActive} active,{" "}
                      {scheduler.queueWaiting} waiting
                    </p>
                  )}
                  <p className="text-xs">
                    Run <code className="text-foreground">npm run worker</code>{" "}
                    in a separate terminal to process scheduled syncs.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  {scheduler?.error ??
                    "Start Redis with docker compose up -d to enable scheduled sync."}
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Copy className="size-4 text-muted-foreground" />
                <span className="font-medium">Webhook sync</span>
                {webhook?.secretConfigured ? (
                  <Badge variant="secondary">Secret configured</Badge>
                ) : (
                  <Badge variant="outline">No secret</Badge>
                )}
              </div>
              {webhook?.url ? (
                <div className="mt-2 space-y-2">
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {webhook.url}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In GitLab, add a group or project webhook for{" "}
                    <strong>Issue events</strong>,{" "}
                    <strong>Merge request events</strong>, and{" "}
                    <strong>Pipeline events</strong>. Set the secret token to{" "}
                    <code className="text-foreground">GITLAB_WEBHOOK_SECRET</code>{" "}
                    from your <code className="text-foreground">.env</code>.
                    Events trigger a debounced project sync (~5s).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(webhook.url ?? "");
                    }}
                  >
                    <Copy />
                    Copy webhook URL
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  Set <code className="text-foreground">NEXT_PUBLIC_APP_URL</code>{" "}
                  in <code className="text-foreground">.env</code> to show the
                  webhook URL.
                </p>
              )}
            </div>

            {lastSync ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Last sync</span>
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
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatRelativeDate(lastSync.startedAt)}
                  {lastSync.itemsCount > 0
                    ? ` · ${lastSync.itemsCount} items`
                    : ""}
                </p>
                {lastSync.error ? (
                  <p className="mt-2 text-destructive">{lastSync.error}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No sync has been run yet. Test the connection, then sync to
                populate the dashboard with live GitLab data.
              </p>
            )}

            {syncMutation.isSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Synced {syncMutation.data.itemsSynced} items from{" "}
                {syncMutation.data.projectsProcessed} projects
                {syncMutation.data.itemsClosed > 0
                  ? ` · ${syncMutation.data.itemsClosed} closed`
                  : ""}
                .
              </p>
            ) : null}

            {syncMutation.isError ? (
              <p className="text-sm text-destructive">
                {(syncMutation.error as Error).message}
              </p>
            ) : null}
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!status?.configured || testMutation.isPending || isSyncing}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Unplug />
          )}
          Test connection
        </Button>
        <Button
          disabled={!status?.configured || isSyncing}
          onClick={() => syncMutation.mutate()}
        >
          {isSyncing ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
