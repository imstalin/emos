"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Pencil,
  Sparkles,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SuggestedActionsList } from "@/features/gitlab-comments/components/suggested-actions-list";
import type {
  AIReplyResponse,
  ApplyActionResult,
  CommentFeedItem,
  ReplyTone,
  SuggestedGitLabAction,
} from "@/domain/types/gitlab-comments-monitor";
import { cn } from "@/lib/utils";

const TONES: { value: ReplyTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "short", label: "Short" },
  { value: "executive", label: "Executive" },
];

interface AiAssistantPanelProps {
  selectedItem: CommentFeedItem;
  aiResult: AIReplyResponse | null;
  onAiResult: (result: AIReplyResponse | null) => void;
  onActionApplied: () => void;
}

async function generateAiReply(body: {
  roughText: string;
  tone: ReplyTone;
  commentId: string;
  targetType: CommentFeedItem["targetType"];
  projectId: number;
  targetIid: number;
}): Promise<AIReplyResponse> {
  const response = await fetch("/api/gitlab/comments/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "AI generation failed");
  }
  return response.json();
}

async function applyAction(body: {
  actionType: SuggestedGitLabAction["type"];
  targetType: CommentFeedItem["targetType"];
  projectId: number;
  targetIid: number;
  payload: Record<string, unknown>;
}): Promise<ApplyActionResult> {
  const response = await fetch("/api/gitlab/comments/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok && !data.auditId) {
    throw new Error(data.error ?? "Action failed");
  }
  return data;
}

export function AiAssistantPanel({
  selectedItem,
  aiResult,
  onAiResult,
  onActionApplied,
}: AiAssistantPanelProps) {
  const [roughText, setRoughText] = useState("");
  const [tone, setTone] = useState<ReplyTone>("professional");
  const [editedReply, setEditedReply] = useState("");
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [ignoredActions, setIgnoredActions] = useState<Set<string>>(new Set());

  const aiMutation = useMutation({
    mutationFn: generateAiReply,
    onSuccess: (result) => {
      onAiResult(result);
      setEditedReply(result.rewrittenReply);
      setIsEditingReply(false);
      setIgnoredActions(new Set());
      setApplyMessage(null);
      setApplyError(null);
    },
  });

  const applyMutation = useMutation({
    mutationFn: applyAction,
    onSuccess: (result) => {
      if (result.ok) {
        setApplyMessage(result.message);
        setApplyError(null);
        onActionApplied();
      } else {
        setApplyError(result.error ?? result.message);
        setApplyMessage(null);
      }
    },
    onError: (error: Error) => {
      setApplyError(error.message);
      setApplyMessage(null);
    },
  });

  const handleGenerate = () => {
    if (!roughText.trim()) return;
    aiMutation.mutate({
      roughText: roughText.trim(),
      tone,
      commentId: selectedItem.id,
      targetType: selectedItem.targetType,
      projectId: selectedItem.projectId,
      targetIid: selectedItem.targetIid,
    });
  };

  const handleApplyAction = (action: SuggestedGitLabAction) => {
    applyMutation.mutate({
      actionType: action.type,
      targetType: selectedItem.targetType,
      projectId: selectedItem.projectId,
      targetIid: selectedItem.targetIid,
      payload: action.payload,
    });
  };

  const handlePostEditedReply = () => {
    applyMutation.mutate({
      actionType: "reply",
      targetType: selectedItem.targetType,
      projectId: selectedItem.projectId,
      targetIid: selectedItem.targetIid,
      payload: { body: editedReply },
    });
  };

  const visibleActions =
    aiResult?.suggestedActions.filter(
      (action) => !ignoredActions.has(actionKey(action)),
    ) ?? [];

  return (
    <Card className="flex min-h-[360px] flex-col lg:min-h-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-violet-500" />
          AI Reply Assistant
        </CardTitle>
        <CardDescription>
          Draft a professional reply and review suggested GitLab actions
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <div className="space-y-2">
          <textarea
            placeholder='Rough input e.g. "check and update today", "ask QA to validate", "need ETA"'
            value={roughText}
            onChange={(event) => setRoughText(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <div className="flex flex-wrap gap-1.5">
            {TONES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTone(item.value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  tone === item.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!roughText.trim() || aiMutation.isPending}
          >
            {aiMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate reply & actions
          </Button>

          {aiMutation.isError ? (
            <p className="text-xs text-destructive">
              {(aiMutation.error as Error).message}
            </p>
          ) : null}
        </div>

        {aiResult ? (
          <>
            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Context summary
              </p>
              <p className="text-xs">{aiResult.contextSummary}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Draft reply
                </p>
                {!isEditingReply ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingReply(true)}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                ) : null}
              </div>

              {isEditingReply ? (
                <textarea
                  value={editedReply}
                  onChange={(event) => setEditedReply(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
                />
              ) : (
                <p className="rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {editedReply}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handlePostEditedReply}
                  disabled={!editedReply.trim() || applyMutation.isPending}
                >
                  {applyMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Post reply to GitLab
                </Button>
                {isEditingReply ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditedReply(aiResult.rewrittenReply);
                      setIsEditingReply(false);
                    }}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>

            <Separator />

            <SuggestedActionsList
              actions={visibleActions}
              isApplying={applyMutation.isPending}
              onApply={handleApplyAction}
              onIgnore={(action) =>
                setIgnoredActions((current) =>
                  new Set(current).add(actionKey(action)),
                )
              }
            />
          </>
        ) : null}

        {applyMessage ? (
          <Badge variant="secondary" className="w-fit text-xs">
            {applyMessage}
          </Badge>
        ) : null}
        {applyError ? (
          <p className="text-xs text-destructive">{applyError}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function actionKey(action: SuggestedGitLabAction): string {
  return `${action.type}:${action.recommendation}`;
}
