"use client";

import { ExternalLink, FileText, Loader2, Rocket } from "lucide-react";
import { useState } from "react";

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
import type {
  PhoenixReleasePlanMode,
  PhoenixReleasePlanPipelineInfo,
  PhoenixReleasePlanPreview,
} from "@/domain/types/phoenix-release-plan";
import { getProblematicJobs } from "@/domain/releases/phoenix-release-plan.builder";

async function fetchPlan(
  mode: PhoenixReleasePlanMode,
): Promise<PhoenixReleasePlanPreview> {
  const response = await fetch(`/api/releases/phoenix-plan?mode=${mode}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load release plan");
  }
  return payload;
}

export function PhoenixReleasePlanCard() {
  const [mode, setMode] = useState<PhoenixReleasePlanMode>("main");
  const [preview, setPreview] = useState<PhoenixReleasePlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePreview(nextMode = mode) {
    setLoading(true);
    setMessage(null);

    try {
      const data = await fetchPlan(nextMode);
      setPreview(data);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIssue() {
    if (!preview) return;

    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/releases/phoenix-plan", {
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
    void handlePreview(parsed);
  }

  const projectCount =
    preview?.sections.reduce((total, section) => total + section.rows.length, 0) ??
    0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="size-4" />
              Phoenix release plan
            </CardTitle>
            <CardDescription>
              Consolidated deploy / rollback table from GitLab tags (matches
              phoenix-release.py)
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {preview ? (
              <Badge variant="outline">{projectCount} projects</Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePreview()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileText className="mr-2 size-4" />
              )}
              Generate preview
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList>
            <TabsTrigger value="main">MAIN</TabsTrigger>
            <TabsTrigger value="dev-qa">DEV-QA</TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="mt-4 space-y-4">
            <PlanContent preview={preview} mode="main" />
          </TabsContent>
          <TabsContent value="dev-qa" className="mt-4 space-y-4">
            <PlanContent preview={preview} mode="dev-qa" />
          </TabsContent>
        </Tabs>

        {preview ? (
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

function ExternalLinkButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      Link
      <ExternalLink className="size-3" />
    </a>
  );
}

function pipelineStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "success":
      return "default";
    case "failed":
      return "destructive";
    case "running":
    case "pending":
    case "created":
    case "waiting_for_resource":
    case "preparing":
      return "secondary";
    default:
      return "outline";
  }
}

function PipelineStatusCell({
  pipeline,
  fallbackUrl,
}: {
  pipeline: PhoenixReleasePlanPipelineInfo | null;
  fallbackUrl: string | null;
}) {
  if (!pipeline?.status) {
    return fallbackUrl ? <ExternalLinkButton href={fallbackUrl} /> : "—";
  }

  const href = pipeline.webUrl ?? fallbackUrl;
  const problemJobs = getProblematicJobs(pipeline);

  return (
    <div className="space-y-1">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1"
        >
          <Badge variant={pipelineStatusVariant(pipeline.status)}>
            {pipeline.status}
          </Badge>
          <ExternalLink className="size-3 text-muted-foreground" />
        </a>
      ) : (
        <Badge variant={pipelineStatusVariant(pipeline.status)}>
          {pipeline.status}
        </Badge>
      )}
      {problemJobs.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {problemJobs.map((job) => (
            <li key={`${job.stage}-${job.name}`}>
              <a
                href={job.webUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground hover:underline"
              >
                {job.stage}/{job.name}: {job.status}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PlanContent({
  preview,
  mode,
}: {
  preview: PhoenixReleasePlanPreview | null;
  mode: PhoenixReleasePlanMode;
}) {
  if (!preview || preview.mode !== mode) {
    return (
      <p className="text-sm text-muted-foreground">
        Click <strong>Generate preview</strong> to load deploy and rollback
        versions from GitLab tags.
      </p>
    );
  }

  if (preview.sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No release groups configured.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {preview.sections.map((section) => (
        <section key={section.groupId} className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">
              {section.groupName
                ? `${section.groupName} (${section.groupId})`
                : section.groupId}
            </h3>
            {section.error ? (
              <p className="text-sm text-destructive">{section.error}</p>
            ) : null}
          </div>

          {section.rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Deploy</th>
                    <th className="px-3 py-2 font-medium">Pipeline</th>
                    <th className="px-3 py-2 font-medium">Rollback</th>
                    <th className="px-3 py-2 font-medium">Pipeline</th>
                    <th className="px-3 py-2 font-medium">Compare</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.projectName} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.projectName}</td>
                      {row.error ? (
                        <td
                          colSpan={5}
                          className="px-3 py-2 text-destructive"
                        >
                          {row.error}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.deployVersion ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <PipelineStatusCell
                              pipeline={row.deployPipeline}
                              fallbackUrl={row.deployPipelineUrl}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.rollbackVersion ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <PipelineStatusCell
                              pipeline={row.rollbackPipeline}
                              fallbackUrl={row.rollbackPipelineUrl}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {row.compareUrl ? (
                              <a
                                href={row.compareUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                Compare
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : section.error ? null : (
            <p className="text-sm text-muted-foreground">No projects found.</p>
          )}
        </section>
      ))}
    </div>
  );
}
