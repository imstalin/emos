"use client";

import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  SprintPlanningItem,
  SprintPlanningMember,
} from "@/domain/types/sprint-planning";
import { getPriorityVariant, getStateLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type SprintMoveOption = {
  id: string;
  name: string;
  isActive: boolean;
};

interface SprintPlanningItemRowProps {
  item: SprintPlanningItem;
  qaMembers?: SprintPlanningMember[];
  selected?: boolean;
  onToggle?: (id: string) => void;
  onQaOwnerChange?: (workItemId: string, qaOwnerId: string | null) => void;
  selectable?: boolean;
  showQaOwner?: boolean;
  qaUpdating?: boolean;
  /** Current sprint id when the row is inside a sprint column (null for backlog). */
  currentSprintId?: string | null;
  sprintMoveOptions?: SprintMoveOption[];
  onMoveToSprint?: (workItemId: string, sprintId: string) => void;
  onMoveToBacklog?: (workItemId: string) => void;
  moveUpdating?: boolean;
}

export function SprintPlanningItemRow({
  item,
  qaMembers = [],
  selected = false,
  onToggle,
  onQaOwnerChange,
  selectable = false,
  showQaOwner = false,
  qaUpdating = false,
  currentSprintId = null,
  sprintMoveOptions = [],
  onMoveToSprint,
  onMoveToBacklog,
  moveUpdating = false,
}: SprintPlanningItemRowProps) {
  const moveTargets = sprintMoveOptions.filter(
    (sprint) => sprint.id !== currentSprintId,
  );
  const canMove =
    Boolean(onMoveToSprint || onMoveToBacklog) &&
    (moveTargets.length > 0 || Boolean(onMoveToBacklog && currentSprintId));

  return (
    <li
      className={cn(
        "flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40",
        selected && "bg-primary/5",
        showQaOwner && !item.qaOwnerId && "border-l-2 border-amber-500/70",
      )}
    >
      {selectable ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle?.(item.id)}
          className="mt-1 size-4 rounded border-input"
          aria-label={`Select ${item.title}`}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.webUrl ? (
              <a
                href={item.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <p className="line-clamp-2 text-sm font-medium leading-snug">
                {item.title}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {item.projectName}
              {item.gitlabIid != null ? ` · #${item.gitlabIid}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.webUrl ? (
              <a
                href={item.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Open in GitLab"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            <Badge variant={getPriorityVariant(item.priority)} className="text-[10px]">
              {item.priority}
            </Badge>
          </div>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Dev:</span>{" "}
            {item.assigneeName ?? "Unassigned"}
          </p>
          {showQaOwner ? (
            <label className="flex items-center gap-1.5 text-[11px]">
              <span className="shrink-0 font-medium text-foreground">QA:</span>
              <select
                value={item.qaOwnerId ?? ""}
                disabled={qaUpdating}
                onChange={(event) =>
                  onQaOwnerChange?.(
                    item.id,
                    event.target.value ? event.target.value : null,
                  )
                }
                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[11px]"
              >
                <option value="">Pick tester</option>
                {qaMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">QA:</span>{" "}
              {item.qaOwnerName ?? "Unassigned"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {getStateLabel(item.state)}
          </Badge>
          {item.milestoneTitle ? (
            <Badge variant="secondary" className="text-[10px]">
              {item.milestoneTitle}
            </Badge>
          ) : null}
          {item.storyPoints != null ? (
            <span className="text-[10px] text-muted-foreground">
              {item.storyPoints} pts
            </span>
          ) : null}
        </div>

        {canMove ? (
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`move-sprint-${item.id}`}>
              Move to sprint
            </label>
            <select
              id={`move-sprint-${item.id}`}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue=""
              disabled={moveUpdating}
              onChange={(event) => {
                const value = event.target.value;
                event.target.value = "";
                if (!value) return;
                if (value === "__backlog__") {
                  onMoveToBacklog?.(item.id);
                  return;
                }
                onMoveToSprint?.(item.id, value);
              }}
            >
              <option value="" disabled>
                Move to sprint…
              </option>
              {moveTargets.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.isActive ? "Active · " : ""}
                  {sprint.name}
                </option>
              ))}
              {onMoveToBacklog && currentSprintId ? (
                <option value="__backlog__">Sprint Backlog</option>
              ) : null}
            </select>
            {moveUpdating ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
