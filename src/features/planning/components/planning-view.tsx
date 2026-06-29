"use client";

import { useCallback, useRef, useState } from "react";
import {
  CalendarRange,
  Download,
  FolderKanban,
  Loader2,
  Save,
  Upload,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  PlanningDocumentData,
  PlanningSheet,
  PlanningSummary,
} from "@/domain/types/planning";
import { PLANNING_SHEET_FY27 } from "@/domain/types/planning";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { PlanningSheetTable } from "@/features/planning/components/planning-sheet-table";
import { formatRelativeDate } from "@/lib/formatters";

interface PlanningViewProps {
  initialDocument: PlanningDocumentData;
  initialSummary: PlanningSummary;
}

export function PlanningView({
  initialDocument,
  initialSummary,
}: PlanningViewProps) {
  const [document, setDocument] = useState(initialDocument);
  const [summary, setSummary] = useState(initialSummary);
  const [activeSheet, setActiveSheet] = useState(
    initialDocument.sheets[0]?.name ?? PLANNING_SHEET_FY27,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const updateLocalSheet = useCallback(
    (sheetName: string, rows: PlanningSheet["rows"]) => {
      setDocument((current) => ({
        ...current,
        sheets: current.sheets.map((sheet) =>
          sheet.name === sheetName ? { ...sheet, rows } : sheet,
        ),
      }));
      setStatusMessage(null);
    },
    [],
  );

  async function saveSheet(sheetName: string) {
    const sheet = document.sheets.find((item) => item.name === sheetName);
    if (!sheet) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/planning", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: document.slug,
          sheetName,
          rows: sheet.rows,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save planning sheet");
      }

      const data = (await response.json()) as {
        document: PlanningDocumentData;
        summary: PlanningSummary;
      };
      setDocument(data.document);
      setSummary(data.summary);
      setStatusMessage("Changes saved.");
    } catch {
      setStatusMessage("Save failed. Check database connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImport(file: File) {
    setIsImporting(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", document.slug);

      const response = await fetch("/api/planning/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Import failed");
      }

      const data = (await response.json()) as {
        document: PlanningDocumentData;
        summary: PlanningSummary;
      };
      setDocument(data.document);
      setSummary(data.summary);
      setActiveSheet(data.document.sheets[0]?.name ?? PLANNING_SHEET_FY27);
      setStatusMessage("Workbook imported.");
    } catch {
      setStatusMessage("Import failed. Ensure the file is a valid .xlsx workbook.");
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  const fy27Sheet = document.sheets.find(
    (sheet) => sheet.name === PLANNING_SHEET_FY27,
  );

  return (
    <>
      <AppHeader
        title="FY Planning"
        description={`${document.name} · Updated ${formatRelativeDate(document.updatedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{document.fiscalYear}</Badge>
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
              href="/api/planning/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" />
              Export
            </a>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() => saveSheet(activeSheet)}
            >
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
            title="FY27 items"
            value={summary.totalItems}
            description="Rows with a title in FY 27 Planning"
            icon={FolderKanban}
          />
          <MetricCard
            title="Planned hours"
            value={summary.totalHours.toLocaleString()}
            description="Sum of numeric Hours column"
            icon={CalendarRange}
          />
          <MetricCard
            title="Quarters"
            value={summary.byQuarter.length}
            description="Distinct quarter groupings"
            icon={CalendarRange}
          />
          <MetricCard
            title="Projects"
            value={summary.byProject.length}
            description="Distinct project streams"
            icon={FolderKanban}
          />
        </div>

        {fy27Sheet ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Hours by quarter</h3>
                <ul className="space-y-2 text-sm">
                  {summary.byQuarter.map((row) => (
                    <li
                      key={row.quarter}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-muted-foreground">{row.quarter}</span>
                      <span className="font-medium">
                        {row.hours.toLocaleString()}h · {row.count} items
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Hours by project</h3>
                <ul className="space-y-2 text-sm">
                  {summary.byProject.map((row) => (
                    <li
                      key={row.project}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-muted-foreground">{row.project}</span>
                      <span className="font-medium">
                        {row.hours.toLocaleString()}h · {row.count} items
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Edit cells inline, then Save. Import restores all three sheets (
              <strong className="text-foreground">FY 26 Current</strong>,{" "}
              <strong className="text-foreground">FY 27 Planning</strong>,{" "}
              <strong className="text-foreground">Pivote</strong>). Export
              regenerates the pivot from FY27 hours and applies Excel header
              styling to match the workbook format.
            </p>

            <Tabs value={activeSheet} onValueChange={setActiveSheet}>
              <TabsList className="mb-4 flex flex-wrap h-auto">
                {document.sheets.map((sheet) => (
                  <TabsTrigger key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.rows.length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {document.sheets.map((sheet) => (
                <TabsContent key={sheet.name} value={sheet.name}>
                  <PlanningSheetTable
                    sheet={sheet}
                    readOnly={sheet.name === "Pivote"}
                    onChange={(rows) => updateLocalSheet(sheet.name, rows)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
