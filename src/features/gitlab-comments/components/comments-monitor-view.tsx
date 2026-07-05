"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAssistantPanel } from "@/features/gitlab-comments/components/ai-assistant-panel";
import { CommentsFeed } from "@/features/gitlab-comments/components/comments-feed";
import { ContextPanel } from "@/features/gitlab-comments/components/context-panel";
import type {
  AIReplyResponse,
  CommentFeedFilters,
  CommentFeedItem,
  CommentFeedResult,
} from "@/domain/types/gitlab-comments-monitor";

interface CommentsMonitorViewProps {
  configured: boolean;
}

async function fetchFeed(
  filters: CommentFeedFilters,
): Promise<CommentFeedResult> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", String(filters.projectId));
  if (filters.author) params.set("author", filters.author);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.label) params.set("label", filters.label);
  if (filters.state) params.set("state", filters.state);
  if (filters.targetType && filters.targetType !== "all") {
    params.set("targetType", filters.targetType);
  }
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.needsActionOnly !== false) {
    params.set("needsActionOnly", "true");
  }
  if (filters.mentionsOnly) params.set("mentionsOnly", "true");
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetch(`/api/gitlab/comments?${params.toString()}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load comments feed");
  }
  return response.json();
}

export function CommentsMonitorView({ configured }: CommentsMonitorViewProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CommentFeedFilters>({
    page: 1,
    limit: 30,
    targetType: "issue",
    state: "opened",
    needsActionOnly: true,
  });
  const [searchInput, setSearchInput] = useState("");
  const [aiResult, setAiResult] = useState<AIReplyResponse | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const feedQuery = useQuery({
    queryKey: ["gitlab-comments-feed", filters],
    queryFn: () => fetchFeed(filters),
    enabled: configured,
    staleTime: 120_000,
    gcTime: 300_000,
    retry: 1,
  });

  const selectedItem: CommentFeedItem | null = useMemo(() => {
    if (!selectedId || !feedQuery.data) return null;
    return feedQuery.data.items.find((item) => item.id === selectedId) ?? null;
  }, [selectedId, feedQuery.data]);

  const handleSelect = useCallback((item: CommentFeedItem) => {
    setSelectedId(item.id);
    setAiResult(null);
  }, []);

  const refreshFeed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gitlab-comments-feed"] });
    queryClient.invalidateQueries({ queryKey: ["gitlab-comment-context"] });
  }, [queryClient]);

  if (!configured) {
    return (
      <>
        <AppHeader
          title="GitLab Issue Comments"
          description="Monitor open issue comments that need your action"
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="size-4 text-amber-500" />
                GitLab not configured
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Configure GitLab in Settings to enable the comments monitor.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const totalPages = feedQuery.data
    ? Math.ceil(feedQuery.data.total / feedQuery.data.limit)
    : 0;

  return (
    <>
      <AppHeader
        title="GitLab Issue Comments"
        description="Open issues with comments that need your action — reply or update via AI-assisted workflow"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refreshFeed}
            disabled={feedQuery.isFetching}
          >
            {feedQuery.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:p-6">
        <div className="flex w-full shrink-0 flex-col lg:w-[380px] xl:w-[420px]">
          <CommentsFeed
            data={feedQuery.data}
            isLoading={feedQuery.isLoading}
            isError={feedQuery.isError}
            error={feedQuery.error as Error | null}
            selectedId={selectedId}
            onSelect={handleSelect}
            filters={filters}
            onFiltersChange={setFilters}
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            page={filters.page ?? 1}
            totalPages={totalPages}
            onPageChange={(page) =>
              setFilters((current) => ({ ...current, page }))
            }
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Issue #{selectedItem.targetIid}</Badge>
                    <span className="truncate text-sm font-medium">
                      {selectedItem.targetTitle}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedItem.projectName}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={
                    <a
                      href={selectedItem.targetWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ExternalLink className="size-4" />
                  Open in GitLab
                </Button>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                <ContextPanel
                  targetType={selectedItem.targetType}
                  projectId={selectedItem.projectId}
                  targetIid={selectedItem.targetIid}
                  selectedComment={selectedItem}
                />

                <AiAssistantPanel
                  selectedItem={selectedItem}
                  aiResult={aiResult}
                  onAiResult={setAiResult}
                  onActionApplied={refreshFeed}
                />
              </div>
            </>
          ) : (
            <Card className="flex flex-1 flex-col items-center justify-center border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <MessageSquareText className="size-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Select a comment</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Choose an open issue from the feed to view context, draft
                  an AI reply, and review suggested GitLab actions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
