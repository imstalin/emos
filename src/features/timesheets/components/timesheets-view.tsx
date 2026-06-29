"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { MetricCard } from "@/features/dashboard/components/metric-card";
import type { MemberTimesheet, TimesheetsReport } from "@/domain/types/timesheets";
import { formatRelativeDate, getInitials } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface TimesheetsViewProps {
  data: TimesheetsReport;
}

function buildCsv(report: TimesheetsReport): string {
  const rows = [
    [
      "Member",
      "Role",
      "Activity",
      "Project",
      "Title",
      "Type",
      "Story Points",
      "Inferred Hours",
      "Last Activity",
    ],
  ];

  for (const member of report.members) {
    if (member.entries.length === 0) {
      rows.push([
        member.name,
        member.role,
        "",
        "",
        "No activity this week",
        "",
        "",
        "0",
        "",
      ]);
      continue;
    }

    for (const entry of member.entries) {
      rows.push([
        member.name,
        member.role,
        entry.activityType,
        entry.projectName,
        entry.title,
        entry.type,
        entry.storyPoints?.toString() ?? "",
        entry.inferredHours.toString(),
        entry.lastActivityAt,
      ]);
    }
  }

  return rows
    .map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function downloadCsv(report: TimesheetsReport) {
  const csv = buildCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `timesheets-${report.weekStart.slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TimesheetsView({ data }: TimesheetsViewProps) {
  const activeMembers = useMemo(
    () => data.members.filter((member) => member.entryCount > 0),
    [data.members],
  );

  const prevWeek = data.weekOffset - 1;
  const nextWeek = data.weekOffset + 1;

  return (
    <>
      <AppHeader
        title="Timesheets"
        description={`AI-inferred weekly work from GitLab activity · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border">
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                disabled={prevWeek < -12}
              >
                <Link
                  href={
                    prevWeek === 0 ? "/timesheets" : `/timesheets?week=${prevWeek}`
                  }
                  aria-label="Previous week"
                >
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
              <span className="flex items-center gap-1.5 px-3 text-sm font-medium">
                <Calendar className="size-3.5 text-muted-foreground" />
                {data.weekLabel}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                disabled={nextWeek > 0}
              >
                <Link
                  href={
                    nextWeek === 0 ? "/timesheets" : `/timesheets?week=${nextWeek}`
                  }
                  aria-label="Next week"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(data)}>
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Inferred hours"
            value={data.totalInferredHours}
            description="From story points & activity"
            icon={Clock}
          />
          <MetricCard
            title="Team capacity"
            value={data.totalCapacityHours}
            description="Weekly hour targets"
            icon={Users}
          />
          <MetricCard
            title="Active members"
            value={data.membersWithActivity}
            description={`Of ${data.members.length} on roster`}
            icon={Users}
          />
          <MetricCard
            title="Avg utilization"
            value={
              data.totalCapacityHours > 0
                ? `${Math.round((data.totalInferredHours / data.totalCapacityHours) * 100)}%`
                : "—"
            }
            description="Inferred vs capacity"
            icon={Clock}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inference model</CardTitle>
            <CardDescription>
              Hours are estimated from GitLab work items with activity this week.
              Story points × 4h, MRs default to 3h, issues to 2h, reviews to 1h.
            </CardDescription>
          </CardHeader>
        </Card>

        {activeMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No GitLab activity recorded for this week. Try an earlier week or
              run a GitLab sync.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {activeMembers.map((member) => (
              <MemberTimesheetCard key={member.memberId} member={member} />
            ))}
          </div>
        )}

        {data.members.some((member) => member.entryCount === 0) ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No activity</CardTitle>
              <CardDescription>
                Team members without GitLab activity this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.members
                  .filter((member) => member.entryCount === 0)
                  .map((member) => (
                    <Badge key={member.memberId} variant="outline">
                      {member.name}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function MemberTimesheetCard({ member }: { member: MemberTimesheet }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{member.name}</CardTitle>
            <CardDescription>{member.role}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">
              {member.inferredHours}h
            </p>
            <p className="text-xs text-muted-foreground">
              of {member.capacityHours}h
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{member.entryCount} activities</span>
            <span>{member.utilizationPercent}% utilized</span>
          </div>
          <Progress
            value={member.utilizationPercent}
            className={cn(
              member.utilizationPercent >= 90 && "[&>div]:bg-amber-500",
              member.utilizationPercent >= 100 && "[&>div]:bg-red-500",
            )}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {member.entries.map((entry) => (
          <div
            key={entry.workItemId}
            className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0 space-y-1">
              <p className="line-clamp-2 font-medium leading-snug">
                {entry.webUrl ? (
                  <a
                    href={entry.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {entry.title}
                  </a>
                ) : (
                  entry.title
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.projectName} · {entry.type.replace(/_/g, " ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <Badge variant="secondary">{entry.inferredHours}h</Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRelativeDate(entry.lastActivityAt)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
