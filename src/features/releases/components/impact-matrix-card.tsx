"use client";

import { ExternalLink, Grid3x3, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ImpactMatrixPreview } from "@/domain/types/impact-matrix";
import type { PhoenixReleasePlanMode } from "@/domain/types/phoenix-release-plan";

async function fetchImpactMatrix(
  mode: PhoenixReleasePlanMode,
): Promise<ImpactMatrixPreview> {
  const response = await fetch(`/api/releases/impact-matrix?mode=${mode}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load impact matrix");
  }
  return payload;
}

function riskBadgeClass(risk: string): string {
  if (risk === "high") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
  }
  if (risk === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

export function ImpactMatrixCard() {
  const [mode, setMode] = useState<PhoenixReleasePlanMode>("main");
  const [preview, setPreview] = useState<ImpactMatrixPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate(nextMode = mode) {
    setLoading(true);
    setMessage(null);

    try {
      const data = await fetchImpactMatrix(nextMode);
      setPreview(data);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIssue() {
    if (!preview) return;

    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/releases/impact-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: preview.mode, confirm: true }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create issue");
      }

      setMessage(
        `Created issue: ${payload.title} — ${payload.issueWebUrl}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function handleModeChange(nextMode: string) {
    const parsed = nextMode as PhoenixReleasePlanMode;
    setMode(parsed);
    setPreview(null);
    setMessage(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid3x3 className="size-4" />
              Impact matrix
            </CardTitle>
            <CardDescription>
              Auto-builds repo → business-flow regression scope from the
              Phoenix release plan
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleGenerate()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Grid3x3 className="mr-2 size-4" />
            )}
            Generate matrix
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList>
            <TabsTrigger value="main">MAIN</TabsTrigger>
            <TabsTrigger value="dev-qa">DEV-QA</TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="mt-4">
            <MatrixContent preview={preview} mode="main" loading={loading} />
          </TabsContent>
          <TabsContent value="dev-qa" className="mt-4">
            <MatrixContent preview={preview} mode="dev-qa" loading={loading} />
          </TabsContent>
        </Tabs>

        {preview && preview.mode === mode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {preview.issueProjectConfigured
                ? `Issue will be created in GitLab project #${preview.issueProjectId}`
                : "Set GITLAB_RELEASE_ISSUE_PROJECT_ID to create GitLab issues"}
            </p>
            <Button
              size="sm"
              onClick={() => void handleCreateIssue()}
              disabled={creating || !preview.issueProjectConfigured}
            >
              {creating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 size-4" />
              )}
              Create GitLab issue
            </Button>
          </div>
        ) : null}

        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MatrixContent({
  preview,
  mode,
  loading,
}: {
  preview: ImpactMatrixPreview | null;
  mode: PhoenixReleasePlanMode;
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Building impact matrix from GitLab release plan… this may take a few
        minutes.
      </p>
    );
  }

  if (!preview || preview.mode !== mode) {
    return (
      <p className="text-sm text-muted-foreground">
        Click <strong>Generate matrix</strong> to map changed repos to business
        flows and regression scope.
      </p>
    );
  }

  if (preview.changedRepos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No changed deploy versions found in the release plan for this
        environment.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{preview.summary.changedRepoCount} changed repos</Badge>
        <Badge variant="outline">{preview.summary.flowCount} flows</Badge>
        <Badge variant="outline" className={riskBadgeClass("high")}>
          {preview.summary.highRiskFlowCount} high risk
        </Badge>
        <Badge variant="outline">
          Regression: {preview.summary.recommendedRegression}
        </Badge>
        {preview.summary.unmappedRepoCount > 0 ? (
          <Badge variant="outline" className={riskBadgeClass("medium")}>
            {preview.summary.unmappedRepoCount} unmapped
          </Badge>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Changed services</h3>
        <MatrixTable
          headers={[
            "Project",
            "Deploy",
            "Flows",
            "Risk",
            "Automation",
            "Compare",
          ]}
          rows={preview.changedRepos.map((repo) => [
            <span key={`${repo.projectName}-name`} className="font-medium">
              {repo.projectName}
              {!repo.mapped ? (
                <span className="ml-1 text-xs text-amber-600">(unmapped)</span>
              ) : null}
            </span>,
            <span key={`${repo.projectName}-deploy`} className="font-mono text-xs">
              {repo.deployVersion}
            </span>,
            repo.flows.join(", "),
            <Badge
              key={`${repo.projectName}-risk`}
              variant="outline"
              className={riskBadgeClass(repo.risk)}
            >
              {repo.risk}
            </Badge>,
            repo.automation,
            repo.compareUrl ? (
              <a
                key={`${repo.projectName}-compare`}
                href={repo.compareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Compare
              </a>
            ) : (
              "—"
            ),
          ])}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Flow impact</h3>
        <MatrixTable
          headers={[
            "Business flow",
            "Repos",
            "Risk",
            "Regression",
            "Suites",
            "Automation",
          ]}
          rows={preview.flowRows.map((row) => [
            row.flow,
            row.triggeredRepos.join(", "),
            <Badge
              key={`${row.flow}-risk`}
              variant="outline"
              className={riskBadgeClass(row.risk)}
            >
              {row.risk}
            </Badge>,
            row.regressionScope,
            <span key={`${row.flow}-suites`} className="text-xs">
              {row.testSuites.join(", ")}
            </span>,
            row.automation,
          ])}
        />
      </section>
    </div>
  );
}

function MatrixTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <tr key={index} className="border-t align-top">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
