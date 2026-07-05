"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SuggestedGitLabAction } from "@/domain/types/gitlab-comments-monitor";
import { cn } from "@/lib/utils";

interface SuggestedActionsListProps {
  actions: SuggestedGitLabAction[];
  isApplying: boolean;
  onApply: (action: SuggestedGitLabAction) => void;
  onIgnore: (action: SuggestedGitLabAction) => void;
}

const CONFIDENCE_STYLE = {
  high: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
} as const;

export function SuggestedActionsList({
  actions,
  isApplying,
  onApply,
  onIgnore,
}: SuggestedActionsListProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedPayloads, setEditedPayloads] = useState<
    Record<string, Record<string, unknown>>
  >({});

  if (actions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No additional GitLab actions suggested.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Suggested GitLab actions
        </p>
        <Badge variant="outline" className="text-[10px]">
          Confirm before apply
        </Badge>
      </div>

      {actions.map((action) => {
        const key = `${action.type}:${action.recommendation}`;
        const isEditing = editingKey === key;
        const payload = editedPayloads[key] ?? action.payload;

        return (
          <div
            key={key}
            className="rounded-lg border p-3 text-xs"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{action.recommendation}</p>
                <p className="mt-0.5 text-muted-foreground">{action.reason}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {action.type.replace(/_/g, " ")}
                </Badge>
                <span
                  className={cn(
                    "text-[10px] capitalize",
                    CONFIDENCE_STYLE[action.confidence],
                  )}
                >
                  {action.confidence} confidence
                </span>
              </div>
            </div>

            <div className="mb-3 rounded-md bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-wrap">
              {isEditing ? (
                <PayloadEditor
                  action={action}
                  payload={payload}
                  onChange={(next) =>
                    setEditedPayloads((current) => ({
                      ...current,
                      [key]: next,
                    }))
                  }
                />
              ) : (
                JSON.stringify(payload, null, 2)
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="default"
                disabled={isApplying}
                onClick={() =>
                  onApply({ ...action, payload })
                }
              >
                {isApplying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditingKey(isEditing ? null : key)
                }
              >
                <Pencil className="size-3.5" />
                {isEditing ? "Done" : "Edit"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onIgnore(action)}
              >
                <X className="size-3.5" />
                Ignore
              </Button>
            </div>

            {action.requiresConfirmation ? (
              <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                <AlertTriangle className="size-3" />
                Requires confirmation — changes apply only when you click Apply
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PayloadEditor({
  action,
  payload,
  onChange,
}: {
  action: SuggestedGitLabAction;
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}) {
  if (action.type === "reply" || action.type === "mr_review") {
    return (
      <textarea
        value={String(payload.body ?? "")}
        onChange={(event) =>
          onChange({ ...payload, body: event.target.value })
        }
        rows={4}
        className="w-full resize-none bg-transparent text-xs outline-none"
      />
    );
  }

  if (action.type === "label_update" || action.type === "release_note") {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="text-muted-foreground">add_labels</span>
          <input
            value={String(payload.add_labels ?? "")}
            onChange={(event) =>
              onChange({ ...payload, add_labels: event.target.value })
            }
            className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">remove_labels</span>
          <input
            value={String(payload.remove_labels ?? "")}
            onChange={(event) =>
              onChange({ ...payload, remove_labels: event.target.value })
            }
            className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1"
          />
        </label>
      </div>
    );
  }

  return (
    <textarea
      value={JSON.stringify(payload, null, 2)}
      onChange={(event) => {
        try {
          onChange(JSON.parse(event.target.value) as Record<string, unknown>);
        } catch {
          // keep invalid JSON until user fixes
        }
      }}
      rows={4}
      className="w-full resize-none bg-transparent font-mono text-xs outline-none"
    />
  );
}
