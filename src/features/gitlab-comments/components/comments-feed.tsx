"use client";

import {
  AlertCircle,
  AtSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CommentFeedFilters,
  CommentFeedItem,
  CommentFeedResult,
} from "@/domain/types/gitlab-comments-monitor";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface CommentsFeedProps {
  data: CommentFeedResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  selectedId: string | null;
  onSelect: (item: CommentFeedItem) => void;
  filters: CommentFeedFilters;
  onFiltersChange: (filters: CommentFeedFilters) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function CommentsFeed({
  data,
  isLoading,
  isError,
  error,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  searchInput,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
}: CommentsFeedProps) {
  const updateFilter = (patch: Partial<CommentFeedFilters>) => {
    onFiltersChange({ ...filters, ...patch, page: 1 });
  };

  return (
    <Card className="flex h-full min-h-[480px] flex-col">
      <CardHeader className="space-y-3 pb-3">
        <div>
          <CardTitle className="text-base">Needs action</CardTitle>
          <CardDescription>
            {data
              ? `${data.total} open issue${data.total === 1 ? "" : "s"} awaiting your response`
              : "Loading open issues from GitLab…"}
          </CardDescription>
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search comments…"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Project"
            value={filters.projectId ? String(filters.projectId) : "ALL"}
            onChange={(value) =>
              updateFilter({
                projectId: value === "ALL" ? undefined : Number(value),
              })
            }
            options={[
              { value: "ALL", label: "All projects" },
              ...(data?.projects.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.count})`,
              })) ?? []),
            ]}
          />
          <FilterSelect
            label="Author"
            value={filters.author ?? "ALL"}
            onChange={(value) =>
              updateFilter({ author: value === "ALL" ? undefined : value })
            }
            options={[
              { value: "ALL", label: "All authors" },
              ...(data?.authors.map((a) => ({ value: a, label: `@${a}` })) ??
                []),
            ]}
          />
          <FilterSelect
            label="Label"
            value={filters.label ?? "ALL"}
            onChange={(value) =>
              updateFilter({ label: value === "ALL" ? undefined : value })
            }
            options={[
              { value: "ALL", label: "All labels" },
              ...(data?.labels.map((l) => ({ value: l, label: l })) ?? []),
            ]}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleChip
            active={Boolean(filters.mentionsOnly)}
            onClick={() =>
              updateFilter({ mentionsOnly: !filters.mentionsOnly })
            }
          >
            <AtSign className="size-3" />
            Mentions only
          </ToggleChip>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error?.message ?? "Failed to load comments"}
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageCircle className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No open issues need your action right now
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {data.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedId === item.id && "bg-muted",
                    )}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MessageCircle className="size-3.5 text-orange-500" />
                        <span className="text-xs font-medium">
                          {item.projectName}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          Issue #{item.targetIid}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          opened
                        </Badge>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatRelativeDate(item.createdAt)}
                      </span>
                    </div>

                    <p className="mb-1 line-clamp-1 text-xs font-medium text-foreground/90">
                      {item.targetTitle}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.body}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {item.authorName}
                      </span>
                      {item.needsAction ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Needs action
                        </Badge>
                      ) : null}
                      {item.mentionsMe ? (
                        <Badge variant="default" className="text-[10px]">
                          @me
                        </Badge>
                      ) : null}
                      {item.labels.slice(0, 2).map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 border-t p-3 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Fetching from GitLab…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 max-w-[140px] truncate rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:border-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}
