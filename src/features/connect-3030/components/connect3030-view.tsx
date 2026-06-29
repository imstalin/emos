"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  Connect3030Dashboard,
  Connect3030Responses,
  Connect3030Session,
  Connect3030Status,
} from "@/domain/types/connect-3030";
import { monthKeyFromDate } from "@/domain/types/connect-3030";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { formatRelativeDate } from "@/lib/formatters";

interface Connect3030ViewProps {
  initialData: Connect3030Dashboard;
}

const STATUS_VARIANT: Record<
  Connect3030Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "outline",
  SCHEDULED: "secondary",
  COMPLETED: "default",
  SKIPPED: "destructive",
};

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKeyFromDate(date);
}

export function Connect3030View({ initialData }: Connect3030ViewProps) {
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(initialData.sessions[0]?.id ?? "");
  const [draft, setDraft] = useState<Connect3030Responses | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => data.sessions.find((session) => session.id === selectedId),
    [data.sessions, selectedId],
  );

  const responses = draft ?? selected?.responses ?? null;

  const loadMonth = useCallback(async (monthKey: string) => {
    const response = await fetch(`/api/connect-3030?month=${monthKey}`);
    if (!response.ok) return;
    const next = (await response.json()) as Connect3030Dashboard;
    setData(next);
    setSelectedId(next.sessions[0]?.id ?? "");
    setDraft(null);
  }, []);

  async function refreshBriefs() {
    setIsRefreshing(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/connect-3030", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey: data.monthKey, action: "refresh" }),
      });
      if (!response.ok) throw new Error("Refresh failed");
      const next = (await response.json()) as Connect3030Dashboard;
      setData(next);
      setDraft(null);
      setStatusMessage("Performance briefs and auto-responses refreshed.");
    } catch {
      setStatusMessage("Refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function saveSession(
    updates: Partial<{
      status: Connect3030Status;
      scheduledAt: string | null;
      responses: Connect3030Responses;
      autofillFromBrief: boolean;
    }>,
  ) {
    if (!selected) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/connect-3030/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: updates.responses ?? responses ?? undefined,
          status: updates.status,
          scheduledAt: updates.scheduledAt,
          autofillFromBrief: updates.autofillFromBrief,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      const session = (await response.json()) as Connect3030Session;
      setData((current) => {
        const sessions = current.sessions.map((row) =>
          row.id === session.id ? session : row,
        );
        return {
          ...current,
          sessions,
          summary: {
            total: sessions.length,
            pending: sessions.filter((row) => row.status === "PENDING").length,
            scheduled: sessions.filter((row) => row.status === "SCHEDULED").length,
            completed: sessions.filter((row) => row.status === "COMPLETED").length,
            skipped: sessions.filter((row) => row.status === "SKIPPED").length,
          },
        };
      });
      setDraft(null);
      setStatusMessage("30:30 connect record saved.");
    } catch {
      setStatusMessage("Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateField<K extends keyof Connect3030Responses>(
    key: K,
    value: Connect3030Responses[K],
  ) {
    if (!responses) return;
    setDraft({ ...responses, [key]: value });
  }

  return (
    <>
      <AppHeader
        title="30:30 Connect"
        description={`30 minutes every 30 days · ${data.monthLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMonth(shiftMonthKey(data.monthKey, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Badge variant="outline">{data.monthLabel}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMonth(shiftMonthKey(data.monthKey, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={refreshBriefs}
            >
              {isRefreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh briefs
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-4 lg:p-6">
        {statusMessage ? (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Team members"
            value={data.summary.total}
            description="Monthly 30:30 sessions"
            icon={MessageSquare}
          />
          <MetricCard
            title="Completed"
            value={data.summary.completed}
            description="Connects done this month"
            icon={CheckCircle2}
          />
          <MetricCard
            title="Scheduled"
            value={data.summary.scheduled}
            description="On calendar"
            icon={Calendar}
          />
          <MetricCard
            title="Pending"
            value={data.summary.pending}
            description="Not yet scheduled"
            icon={Sparkles}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <Card>
            <CardContent className="flex flex-col gap-2 p-3">
              <p className="px-1 text-xs font-medium text-muted-foreground">
                Team · {data.monthLabel}
              </p>
              {data.sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(session.id);
                    setDraft(null);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    session.id === selectedId
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium">{session.memberName}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[session.status]} className="text-xs">
                      {session.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {session.memberRole}
                    </span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {selected && responses ? (
            <Card>
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.memberName}</h2>
                    <p className="text-sm text-muted-foreground">
                      30:30 connect · Updated {formatRelativeDate(selected.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => saveSession({ autofillFromBrief: true })}
                    >
                      <Sparkles className="size-4" />
                      Auto-fill responses
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() =>
                        saveSession({
                          status: "SCHEDULED",
                          scheduledAt: new Date().toISOString(),
                        })
                      }
                    >
                      Mark scheduled
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={() => saveSession({ status: "COMPLETED" })}
                    >
                      {isSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Mark complete
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={() => saveSession({})}
                    >
                      <Save className="size-4" />
                      Save
                    </Button>
                  </div>
                </div>

                <section className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold">Auto-generated brief</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    From GitLab activity, KPIs, and open follow-ups for{" "}
                    {selected.autoBrief.monthLabel}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {selected.autoBrief.talkingPoints.map((point) => (
                      <li key={point} className="text-muted-foreground">
                        • {point}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.autoBrief.performance.kpiHighlights
                      .slice(0, 4)
                      .map((row) => (
                        <Badge key={row.kpi} variant="secondary">
                          {row.kpi}: {row.score ?? "—"}%
                        </Badge>
                      ))}
                  </div>
                </section>

                <ResponseField
                  label="Performance discussed"
                  value={responses.performanceDiscussed}
                  onChange={(value) => updateField("performanceDiscussed", value)}
                />
                <ResponseField
                  label="Goals for next 30 days"
                  value={responses.goalsForNextPeriod}
                  onChange={(value) => updateField("goalsForNextPeriod", value)}
                />
                <ResponseField
                  label="Member commitments"
                  value={responses.memberCommitments}
                  onChange={(value) => updateField("memberCommitments", value)}
                />
                <ResponseField
                  label="Manager support / actions"
                  value={responses.managerSupport}
                  onChange={(value) => updateField("managerSupport", value)}
                />
                <ResponseField
                  label="Member feedback"
                  value={responses.memberFeedback}
                  onChange={(value) => updateField("memberFeedback", value)}
                />

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Action items</h3>
                  <ul className="space-y-2">
                    {responses.actionItems.map((item, index) => (
                      <li key={item.id} className="flex gap-2">
                        <Input
                          value={item.text}
                          onChange={(event) => {
                            const next = [...responses.actionItems];
                            next[index] = { ...item, text: event.target.value };
                            updateField("actionItems", next);
                          }}
                          className="flex-1"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Select a team member to record their 30:30 connect.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ResponseField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="min-h-[6rem] w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
    </label>
  );
}
