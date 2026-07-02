"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";

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
  LinkedInContextSummary,
  LinkedInPostSuggestion,
  LinkedInPostType,
  LinkedInSuggestionsRequest,
  LinkedInSuggestionsResponse,
  LinkedInTimeRange,
  LinkedInTone,
} from "@/domain/types/linkedin-pm";
import {
  LINKEDIN_POST_TYPE_LABELS,
  LINKEDIN_SUGGESTED_FOCUS,
  LINKEDIN_TIME_RANGE_LABELS,
  LINKEDIN_TONE_LABELS,
} from "@/domain/types/linkedin-pm";
import type { AssistantStatus } from "@/domain/types/assistant";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const fieldClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface LinkedInPmViewProps {
  status: AssistantStatus;
}

async function fetchContext(
  timeRange: LinkedInTimeRange,
  anonymizeTeam: boolean,
): Promise<LinkedInContextSummary> {
  const params = new URLSearchParams({
    timeRange,
    anonymizeTeam: String(anonymizeTeam),
  });
  const response = await fetch(`/api/linkedin/context?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load activity context");
  return response.json();
}

async function generateSuggestions(
  request: LinkedInSuggestionsRequest,
): Promise<LinkedInSuggestionsResponse> {
  const response = await fetch("/api/linkedin/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const body = (await response.json()) as LinkedInSuggestionsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? "Generation failed");
  }

  return body;
}

function formatPostForCopy(suggestion: LinkedInPostSuggestion): string {
  const tags = suggestion.hashtags.map((tag) =>
    tag.startsWith("#") ? tag : `#${tag}`,
  );
  return [suggestion.hook, "", suggestion.body, "", suggestion.cta, "", tags.join(" ")]
    .filter(Boolean)
    .join("\n");
}

export function LinkedInPmView({ status }: LinkedInPmViewProps) {
  const [postType, setPostType] = useState<LinkedInPostType>("weekly_update");
  const [tone, setTone] = useState<LinkedInTone>("professional");
  const [timeRange, setTimeRange] = useState<LinkedInTimeRange>("month");
  const [anonymizeTeam, setAnonymizeTeam] = useState(true);
  const [customFocus, setCustomFocus] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [results, setResults] = useState<LinkedInSuggestionsResponse | null>(null);

  const contextQuery = useQuery({
    queryKey: ["linkedin-context", timeRange, anonymizeTeam],
    queryFn: () => fetchContext(timeRange, anonymizeTeam),
    enabled: status.configured,
  });

  const generateMutation = useMutation({
    mutationFn: generateSuggestions,
    onSuccess: (data) => {
      setResults(data);
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      postType,
      tone,
      timeRange,
      anonymizeTeam,
      customFocus: customFocus.trim() || undefined,
    });
  };

  const copyPost = async (suggestion: LinkedInPostSuggestion) => {
    await navigator.clipboard.writeText(formatPostForCopy(suggestion));
    setCopiedId(suggestion.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const contextSummary = results?.contextSummary ?? contextQuery.data;

  return (
    <>
      <AppHeader
        title="AI PM · LinkedIn"
        description="Post ideas grounded in your EMOS delivery activity"
        actions={
          status.configured ? (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="size-3" />
              {status.model}
            </Badge>
          ) : (
            <Badge variant="destructive">OpenAI not configured</Badge>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <div className="flex w-full flex-col gap-4 lg:max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post settings</CardTitle>
              <CardDescription>
                AI reads your GitLab activity, releases, roadmap, and team load
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!status.configured ? (
                <p className="text-sm text-muted-foreground">
                  Add <code className="text-foreground">OPENAI_API_KEY</code> to
                  enable generation.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="post-type">
                      Post type
                    </label>
                    <select
                      id="post-type"
                      className={fieldClassName}
                      value={postType}
                      onChange={(event) =>
                        setPostType(event.target.value as LinkedInPostType)
                      }
                    >
                      {Object.entries(LINKEDIN_POST_TYPE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="tone">
                      Tone
                    </label>
                    <select
                      id="tone"
                      className={fieldClassName}
                      value={tone}
                      onChange={(event) =>
                        setTone(event.target.value as LinkedInTone)
                      }
                    >
                      {Object.entries(LINKEDIN_TONE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="time-range">
                      Activity window
                    </label>
                    <select
                      id="time-range"
                      className={fieldClassName}
                      value={timeRange}
                      onChange={(event) =>
                        setTimeRange(event.target.value as LinkedInTimeRange)
                      }
                    >
                      {Object.entries(LINKEDIN_TIME_RANGE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={anonymizeTeam}
                      onChange={(event) => setAnonymizeTeam(event.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    Anonymize team member names
                  </label>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="focus">
                      Optional focus
                    </label>
                    <textarea
                      id="focus"
                      placeholder="e.g. Monthly release delivery, FY27 planning…"
                      value={customFocus}
                      onChange={(event) => setCustomFocus(event.target.value)}
                      rows={3}
                      className={cn(fieldClassName, "h-auto resize-y py-2")}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LINKEDIN_SUGGESTED_FOCUS.map((focus) => (
                      <Button
                        key={focus}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomFocus(focus)}
                      >
                        {focus}
                      </Button>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    disabled={generateMutation.isPending}
                    onClick={handleGenerate}
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Megaphone className="size-4" />
                    )}
                    Generate LinkedIn posts
                  </Button>

                  {generateMutation.isError ? (
                    <p className="text-sm text-destructive">
                      {generateMutation.error.message}
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Your activity</CardTitle>
                <CardDescription>
                  {contextSummary
                    ? `Updated ${formatRelativeDate(contextSummary.generatedAt)}`
                    : "Loading delivery snapshot…"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={contextQuery.isFetching}
                onClick={() => void contextQuery.refetch()}
              >
                <RefreshCw
                  className={`size-4 ${contextQuery.isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {contextQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : contextSummary ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <StatPill
                      label="Recent items"
                      value={contextSummary.stats.recentActivityCount}
                    />
                    <StatPill
                      label="Follow-ups"
                      value={contextSummary.stats.openFollowUps}
                    />
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {contextSummary.highlights.slice(0, 8).map((line, index) => (
                      <li key={`${line}-${index}`} className="leading-snug">
                        {line.startsWith("  ·") ? line.trim() : `· ${line}`}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Could not load activity context.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!results ? (
            <Card className="flex flex-1 items-center justify-center">
              <CardContent className="py-16 text-center">
                <Megaphone className="mx-auto size-10 text-muted-foreground/40" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Configure your post settings and click{" "}
                  <strong>Generate LinkedIn posts</strong> to get 3 ideas based on
                  your real delivery activity.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {results.suggestions.length} suggestions · generated{" "}
                {formatRelativeDate(results.generatedAt)}
              </p>
              <div className="grid gap-4 xl:grid-cols-1">
                {results.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    copied={copiedId === suggestion.id}
                    onCopy={() => void copyPost(suggestion)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  copied,
  onCopy,
}: {
  suggestion: LinkedInPostSuggestion;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="secondary">{suggestion.angle}</Badge>
            <CardTitle className="mt-2 text-base leading-snug">
              {suggestion.hook}
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onCopy}>
            {copied ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy post"}
          </Button>
        </div>
        {suggestion.sourceRefs.length > 0 ? (
          <CardDescription>
            Based on: {suggestion.sourceRefs.slice(0, 2).join(" · ")}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {suggestion.body}
        </p>
        {suggestion.cta ? (
          <p className="text-sm font-medium">{suggestion.cta}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {suggestion.hashtags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag.startsWith("#") ? tag : `#${tag}`}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
