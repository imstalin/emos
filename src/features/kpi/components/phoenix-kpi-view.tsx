"use client";

import { useCallback, useRef, useState } from "react";
import {
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PhoenixKpiData, PhoenixKpiRow } from "@/domain/types/phoenix-kpi";
import type { PhoenixMemberKpiReport } from "@/domain/types/phoenix-kpi";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { PhoenixMemberKpiPanel } from "@/features/kpi/components/phoenix-member-kpi-panel";
import { PhoenixKpiTable } from "@/features/kpi/components/phoenix-kpi-table";
import { formatRelativeDate } from "@/lib/formatters";
import { computeYtdScore } from "@/domain/kpi/phoenix-kpi-utils";

interface PhoenixKpiViewProps {
  initialData: PhoenixKpiData;
  initialMemberReport: PhoenixMemberKpiReport;
}

const AUTOMATED_KPIS = [
  "Schedule Adherence",
  "Effort Adherence",
  "First Time Right",
  "Effort Throughput",
  "Code Review Compliance",
  "Time to market",
  "Utilization",
];

export function PhoenixKpiView({
  initialData,
  initialMemberReport,
}: PhoenixKpiViewProps) {
  const [data, setData] = useState(initialData);
  const [memberReport, setMemberReport] = useState(initialMemberReport);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutomating, setIsAutomating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const applicableCount = data.document.rows.filter((row) => row.applicable).length;
  const automatedRows = data.document.rows.filter((row) =>
    row.monthly.some((month) => month.automated),
  ).length;

  const onRowChange = useCallback((rowId: string, updates: Partial<PhoenixKpiRow>) => {
    setData((current) => ({
      ...current,
      document: {
        ...current.document,
        rows: current.document.rows.map((row) => {
          if (row.id !== rowId) return row;
          const merged = { ...row, ...updates };
          return {
            ...merged,
            ytdScore: computeYtdScore(merged),
          };
        }),
      },
    }));
    setStatusMessage(null);
  }, []);

  async function saveDocument() {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/kpi/phoenix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          document: data.document,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      const saved = (await response.json()) as PhoenixKpiData;
      setData(saved);
      setStatusMessage("Phoenix KPI sheet saved.");
    } catch {
      setStatusMessage("Save failed. Check database connection.");
    } finally {
      setIsSaving(false);
    }
  }

  async function automateScores() {
    setIsAutomating(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/kpi/phoenix/automate", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Automate failed");
      const result = (await response.json()) as PhoenixKpiData & {
        automate: { updatedKpis: string[]; skippedKpis: string[] };
      };
      setData(result);
      const membersResponse = await fetch("/api/kpi/phoenix/members");
      if (membersResponse.ok) {
        setMemberReport(
          (await membersResponse.json()) as PhoenixMemberKpiReport,
        );
      }
      setStatusMessage(
        `Automated ${result.automate.updatedKpis.length} KPIs from GitLab data. Manual KPIs kept unchanged.`,
      );
    } catch {
      setStatusMessage("Automation failed.");
    } finally {
      setIsAutomating(false);
    }
  }

  async function handleImport(file: File) {
    setIsImporting(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", data.slug);

      const response = await fetch("/api/kpi/phoenix/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Import failed");
      const imported = (await response.json()) as PhoenixKpiData;
      setData(imported);
      setStatusMessage("Workbook imported.");
    } catch {
      setStatusMessage("Import failed. Ensure Phoenix sheet exists in file.");
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <>
      <AppHeader
        title="Phoenix KPI Sheet"
        description={`${data.document.sheetName} · Updated ${formatRelativeDate(data.updatedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{data.fiscalYear}</Badge>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={isImporting}
              onClick={() => importInputRef.current?.click()}
            >
              {isImporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import
            </Button>
            <a
              href="/api/kpi/phoenix/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" />
              Export
            </a>
            <Button
              variant="outline"
              size="sm"
              disabled={isAutomating}
              onClick={automateScores}
            >
              {isAutomating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Automate
            </Button>
            <Button size="sm" disabled={isSaving} onClick={saveDocument}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
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
            title="KPI metrics"
            value={data.document.rows.length}
            description="Rows on Phoenix sheet"
            icon={Sparkles}
          />
          <MetricCard
            title="Applicable"
            value={applicableCount}
            description="KPIs marked Yes"
            icon={Sparkles}
          />
          <MetricCard
            title="Auto-filled"
            value={automatedRows}
            description="Rows with automated monthly scores"
            icon={RefreshCw}
          />
          <MetricCard
            title="FY months"
            value={data.document.months.length}
            description="Monthly score columns"
            icon={Sparkles}
          />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <Tabs defaultValue="team">
              <TabsList>
                <TabsTrigger value="team">Team Phoenix sheet</TabsTrigger>
                <TabsTrigger value="members">
                  By member ({memberReport.members.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="team" className="mt-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Automated from GitLab</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Click <strong className="text-foreground">Automate</strong> to
                    recalculate team scores from monitored GitLab projects. Manual
                    KPIs remain editable on this tab.
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {AUTOMATED_KPIS.map((kpi) => (
                      <Badge key={kpi} variant="secondary" className="text-xs">
                        {kpi}
                      </Badge>
                    ))}
                  </ul>
                </div>
                <PhoenixKpiTable data={data} onRowChange={onRowChange} />
              </TabsContent>

              <TabsContent value="members" className="mt-4">
                <PhoenixMemberKpiPanel report={memberReport} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
