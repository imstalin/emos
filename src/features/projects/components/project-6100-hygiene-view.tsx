"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, ClipboardList, ExternalLink, Loader2, RefreshCw, Tag, UserX } from "lucide-react";

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
import type {
  HygieneGap,
  ProjectHygieneReport,
} from "@/domain/types/project-hygiene";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { formatRelativeDate } from "@/lib/formatters";

const GAP_LABELS: Record<HygieneGap, string> = {
  missing_weight: "No Weight",
  missing_assignee: "Unassigned",
  missing_type_label: "No Type::",
  missing_feature_label: "No Feature::",
  missing_priority_label: "No priority",
  missing_due_date: "No due date",
  missing_milestone: "No milestone",
};

interface Project6100HygieneViewProps {
  initialReport?: ProjectHygieneReport;
}

async function fetchReport(): Promise<ProjectHygieneReport> {
  const response = await fetch("/api/projects/6100/hygiene");
  if (!response.ok) throw new Error("Failed to load hygiene report");
  return response.json();
}

export function Project6100HygieneView({ initialReport }: Project6100HygieneViewProps = {}) {
  const reportQuery = useQuery({
    queryKey: ["project-6100-hygiene"],
    queryFn: fetchReport,
    initialData: initialReport,
    staleTime: 60_000,
  });

  const report = reportQuery.data;

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { summary } = report;

  return (
    <>
      <AppHeader
        title="Project 6100 — Delivery Hygiene"
        description={`${report.projectName} · ${report.projectPath ?? "admin"} · Updated ${formatRelativeDate(report.generatedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{summary.totalOpen} open</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reportQuery.refetch()}
              disabled={reportQuery.isFetching}
            >
              {reportQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Label & effort standards</CardTitle>
            <CardDescription>
              Every open issue should have{" "}
              <code className="text-xs">Type::*</code>,{" "}
              <code className="text-xs">Feature::*</code>,{" "}
              <code className="text-xs">priority::*</code>, GitLab{" "}
              <strong>Weight</strong>, assignee, and milestone. High/critical
              items also need a due date.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Missing Weight"
            value={summary.missingWeight}
            description="Open issues without story points"
            icon={ClipboardList}
            health={summary.missingWeight > 20 ? "CRITICAL" : summary.missingWeight > 0 ? "AT_RISK" : "HEALTHY"}
          />
          <MetricCard
            title="Unassigned"
            value={summary.missingAssignee}
            description="Open items with no owner"
            icon={UserX}
            health={summary.missingAssignee > 10 ? "AT_RISK" : "HEALTHY"}
          />
          <MetricCard
            title="Label gaps"
            value={summary.missingLabels}
            description="Missing Type, Feature, or priority labels"
            icon={Tag}
          />
          <MetricCard
            title="Fully compliant"
            value={summary.fullyCompliant}
            description={`Of ${summary.totalOpen} open synced items`}
            icon={CheckCircle2}
            health="HEALTHY"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gap breakdown</CardTitle>
            <CardDescription>
              Items can have multiple gaps. Fix Weight first to unlock capacity
              planning in Team Dashboard and Timesheets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(summary.byGap) as Array<[HygieneGap, number]>).map(
                ([gap, count]) => (
                  <Badge key={gap} variant={count > 0 ? "secondary" : "outline"}>
                    {GAP_LABELS[gap]}: {count}
                  </Badge>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Items needing attention ({report.items.length})
            </CardTitle>
            <CardDescription>
              Sorted by priority. Open in GitLab to add Weight, labels, assignee,
              or milestone.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {report.items.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {summary.totalOpen === 0
                  ? "No synced open items yet. Run GitLab sync from Settings."
                  : "All open items meet the hygiene checklist."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Issue</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium">Weight</th>
                      <th className="px-4 py-3 font-medium">Assignee</th>
                      <th className="px-4 py-3 font-medium">Milestone</th>
                      <th className="px-4 py-3 font-medium">Gaps</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.items.slice(0, 100).map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="max-w-md truncate font-medium">
                            {item.gitlabIid ? `#${item.gitlabIid}` : "—"}{" "}
                            {item.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {item.labels.slice(0, 4).join(" · ")}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{item.priority}</Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {item.storyPoints ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {item.assigneeName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {item.milestoneTitle ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.gaps.map((gap) => (
                              <Badge
                                key={gap}
                                variant="destructive"
                                className="text-[10px]"
                              >
                                {GAP_LABELS[gap]}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.webUrl ? (
                            <Link
                              href={item.webUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"
                            >
                              <ExternalLink className="size-4" />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.items.length > 100 ? (
                  <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                    Showing first 100 of {report.items.length} items with gaps.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Related:{" "}
          <Link href="/gitlab" className="underline underline-offset-2">
            GitLab Activity
          </Link>
          {" · "}
          <Link href="/governance" className="underline underline-offset-2">
            Governance
          </Link>
          {" · "}
          <Link href="/team" className="underline underline-offset-2">
            Team Dashboard
          </Link>
          {" · "}
          <Link href="/roadmap" className="underline underline-offset-2">
            Roadmap
          </Link>
        </p>
      </div>
    </>
  );
}
