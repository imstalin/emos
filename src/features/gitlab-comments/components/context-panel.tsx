"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  GitMerge,
  Link2,
  Loader2,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CommentContextPanel,
  CommentFeedItem,
  CommentTargetType,
} from "@/domain/types/gitlab-comments-monitor";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  targetType: CommentTargetType;
  projectId: number;
  targetIid: number;
  selectedComment: CommentFeedItem;
}

async function fetchContext(
  targetType: CommentTargetType,
  projectId: number,
  targetIid: number,
): Promise<CommentContextPanel> {
  const params = new URLSearchParams({
    targetType,
    projectId: String(projectId),
    targetIid: String(targetIid),
  });
  const response = await fetch(`/api/gitlab/comments/context?${params}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load context");
  }
  return response.json();
}

export function ContextPanel({
  targetType,
  projectId,
  targetIid,
  selectedComment,
}: ContextPanelProps) {
  const contextQuery = useQuery({
    queryKey: ["gitlab-comment-context", targetType, projectId, targetIid],
    queryFn: () => fetchContext(targetType, projectId, targetIid),
  });

  const context = contextQuery.data;

  return (
    <Card className="flex min-h-[360px] flex-col lg:min-h-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Context</CardTitle>
        <CardDescription>
          Issue/MR details and comment thread
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-0">
        {contextQuery.isLoading ? (
          <div className="space-y-3 px-4 pb-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : contextQuery.isError ? (
          <div className="flex items-start gap-2 px-4 pb-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4" />
            {(contextQuery.error as Error).message}
          </div>
        ) : context ? (
          <>
            <div className="space-y-2 px-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{context.state}</Badge>
                {context.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>

              <MetaRow icon={<User className="size-3.5" />} label="Assignee">
                {context.assignee?.name ?? "Unassigned"}
              </MetaRow>
              {context.milestone ? (
                <MetaRow icon={<Calendar className="size-3.5" />} label="Milestone">
                  {context.milestone.title}
                </MetaRow>
              ) : null}
              {context.epic ? (
                <MetaRow icon={<Link2 className="size-3.5" />} label="Epic">
                  #{context.epic.iid} {context.epic.title}
                </MetaRow>
              ) : null}
              {context.dueDate ? (
                <MetaRow icon={<Calendar className="size-3.5" />} label="Due">
                  {context.dueDate}
                </MetaRow>
              ) : null}
              {context.mergeStatus ? (
                <MetaRow icon={<GitMerge className="size-3.5" />} label="Merge">
                  {context.mergeStatus}
                  {context.pipeline ? ` · pipeline ${context.pipeline.status}` : ""}
                </MetaRow>
              ) : null}
              {context.reviewers.length > 0 ? (
                <MetaRow icon={<User className="size-3.5" />} label="Reviewers">
                  {context.reviewers.map((r) => r.name).join(", ")}
                </MetaRow>
              ) : null}
            </div>

            {context.description ? (
              <>
                <Separator />
                <div className="px-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Description
                  </p>
                  <p className="line-clamp-4 text-xs whitespace-pre-wrap">
                    {context.description}
                  </p>
                </div>
              </>
            ) : null}

            {context.linkedIssues.length > 0 ? (
              <>
                <Separator />
                <div className="px-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Linked issues
                  </p>
                  <ul className="space-y-1 text-xs">
                    {context.linkedIssues.map((issue) => (
                      <li key={issue.iid}>
                        <a
                          href={issue.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          #{issue.iid} {issue.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            <Separator />

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Comment thread
              </p>
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                  {context.previousComments
                    .filter((note) => !note.system && note.body?.trim())
                    .map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          "rounded-lg border p-2.5 text-xs",
                          note.id === selectedComment.noteId &&
                            "border-primary/50 bg-primary/5",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium">{note.authorName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {note.body}
                        </p>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span>{children}</span>
    </div>
  );
}
