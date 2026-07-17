"use client";

import type { SprintIntelligenceMilestone } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function MilestoneSelector({
  milestones,
  selectedId,
  onSelect,
  disabled,
}: {
  milestones: SprintIntelligenceMilestone[];
  selectedId: number | null;
  onSelect: (milestone: SprintIntelligenceMilestone) => void;
  disabled?: boolean;
}) {
  const selected = milestones.find((m) => m.milestoneId === selectedId);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <label htmlFor="si-milestone" className="text-sm font-medium">
          Sprint milestone
        </label>
        <select
          id="si-milestone"
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          value={selectedId ?? ""}
          disabled={disabled || milestones.length === 0}
          onChange={(event) => {
            const id = Number(event.target.value);
            const milestone = milestones.find((m) => m.milestoneId === id);
            if (milestone) onSelect(milestone);
          }}
          aria-describedby="si-milestone-help"
        >
          <option value="" disabled>
            Select a sprint milestone
          </option>
          {milestones.map((milestone) => (
            <option key={milestone.milestoneId} value={milestone.milestoneId}>
              {milestone.title}
              {milestone.isActive ? " (active)" : ""}
            </option>
          ))}
        </select>
        <p id="si-milestone-help" className="text-xs text-muted-foreground">
          Analysis does not start automatically when the page loads.
        </p>
      </div>
      {selected ? (
        <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          <p>
            {selected.startDate} → {selected.dueDate}
          </p>
          <p>
            {selected.projectIds.length} project
            {selected.projectIds.length === 1 ? "" : "s"}
            {selected.latestAnalysis
              ? ` · latest run ${selected.latestAnalysis.status}`
              : " · no prior run"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
