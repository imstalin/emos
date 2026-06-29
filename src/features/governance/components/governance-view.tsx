"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Shield } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GovernanceReport } from "@/domain/types/governance";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type SeverityFilter = "ALL" | "error" | "warning" | "info";

interface GovernanceViewProps {
  report: GovernanceReport;
}

export function GovernanceView({ report }: GovernanceViewProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");

  const filteredViolations = useMemo(() => {
    if (severityFilter === "ALL") return report.violations;
    return report.violations.filter(
      (violation) => violation.severity === severityFilter,
    );
  }, [report.violations, severityFilter]);

  return (
    <>
      <AppHeader
        title="Governance"
        description={`Delivery hygiene score · Updated ${formatRelativeDate(report.generatedAt)}`}
        actions={
          <Badge variant="outline" className="gap-1">
            <Shield className="size-3" />
            {report.violationCount} violations
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Governance score</CardTitle>
              <CardDescription>
                Based on {report.totalItems} open work items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2">
                <p
                  className={cn(
                    "text-4xl font-semibold tabular-nums",
                    report.score >= 80
                      ? "text-emerald-600 dark:text-emerald-400"
                      : report.score >= 60
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {report.score}
                </p>
                <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
              </div>
              <Progress value={report.score} />
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">
                  {report.violationsBySeverity.error} errors
                </Badge>
                <Badge variant="secondary">
                  {report.violationsBySeverity.warning} warnings
                </Badge>
                <Badge variant="outline">
                  {report.violationsBySeverity.info} info
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Rule breakdown</CardTitle>
              <CardDescription>Violations per enabled governance rule</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {report.rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.category} · {rule.severity}
                      </p>
                    </div>
                    <Badge
                      variant={
                        rule.violationCount > 0 ? "secondary" : "outline"
                      }
                    >
                      {rule.violationCount}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Violations</CardTitle>
              <CardDescription>
                Open work items that fail governance rules
              </CardDescription>
            </div>
            <Tabs
              value={severityFilter}
              onValueChange={(value) =>
                setSeverityFilter(value as SeverityFilter)
              }
            >
              <TabsList>
                <TabsTrigger value="ALL">All ({report.violationCount})</TabsTrigger>
                <TabsTrigger value="error">
                  Errors ({report.violationsBySeverity.error})
                </TabsTrigger>
                <TabsTrigger value="warning">
                  Warnings ({report.violationsBySeverity.warning})
                </TabsTrigger>
                <TabsTrigger value="info">
                  Info ({report.violationsBySeverity.info})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {filteredViolations.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                <Shield className="size-4" />
                No violations for this filter.
              </div>
            ) : (
              <ul className="divide-y">
                {filteredViolations.map((violation) => (
                  <li
                    key={`${violation.ruleId}-${violation.workItemId}`}
                    className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {violation.webUrl ? (
                            <a
                              href={violation.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-sm font-medium hover:underline"
                            >
                              {violation.workItemTitle}
                            </a>
                          ) : (
                            <p className="truncate text-sm font-medium">
                              {violation.workItemTitle}
                            </p>
                          )}
                          {violation.webUrl ? (
                            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {violation.projectName}
                          {violation.assigneeName
                            ? ` · ${violation.assigneeName}`
                            : ""}
                        </p>
                      </div>
                      <SeverityBadge severity={violation.severity} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {violation.ruleName}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {violation.workItemType}
                      </Badge>
                      {violation.description ? (
                        <span className="text-xs text-muted-foreground">
                          {violation.description}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "error") {
    return (
      <Badge variant="destructive" className="gap-1 shrink-0">
        <AlertTriangle className="size-3" />
        Error
      </Badge>
    );
  }

  if (severity === "warning") {
    return <Badge variant="secondary" className="shrink-0">Warning</Badge>;
  }

  return <Badge variant="outline" className="shrink-0">Info</Badge>;
}
