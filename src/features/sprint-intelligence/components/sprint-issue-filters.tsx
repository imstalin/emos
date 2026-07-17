"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IssueFilters } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

const PLANNING = ["Planned", "Unplanned", "UnableToDetermine", "NotApplicable"];
const DELIVERY = [
  "Committed",
  "Spillover",
  "CompletedUnplanned",
  "OpenUnplanned",
  "Excluded",
  "UnableToDetermine",
  "NotApplicable",
];
const WORK_TYPES = [
  "Regression",
  "Bug",
  "Enhancement",
  "Support",
  "Hotfix",
  "TechnicalDebt",
  "UAT",
  "ReleaseValidation",
  "Deployment",
  "Unknown",
];

export function SprintIssueFilters({
  filters,
  onChange,
  onClear,
  activeCount,
}: {
  filters: IssueFilters;
  onChange: (next: Partial<IssueFilters>) => void;
  onClear: () => void;
  activeCount: number;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={activeCount === 0}
        >
          Clear filters
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Input
          value={filters.search ?? ""}
          onChange={(event) =>
            onChange({ search: event.target.value || undefined, page: 1 })
          }
          placeholder="Search IID or title"
          aria-label="Search by issue IID or title"
        />
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={filters.planningStatus ?? ""}
          onChange={(event) =>
            onChange({
              planningStatus: event.target.value || undefined,
              page: 1,
            })
          }
          aria-label="Planning status"
        >
          <option value="">Planning status</option>
          {PLANNING.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={filters.deliveryStatus ?? ""}
          onChange={(event) =>
            onChange({
              deliveryStatus: event.target.value || undefined,
              page: 1,
            })
          }
          aria-label="Delivery status"
        >
          <option value="">Delivery status</option>
          {DELIVERY.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={filters.workType ?? ""}
          onChange={(event) =>
            onChange({ workType: event.target.value || undefined, page: 1 })
          }
          aria-label="Work type"
        >
          <option value="">Work type</option>
          {WORK_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={filters.state ?? ""}
          onChange={(event) =>
            onChange({
              state: (event.target.value || undefined) as
                | "opened"
                | "closed"
                | undefined,
              page: 1,
            })
          }
          aria-label="Open or closed"
        >
          <option value="">Open / closed</option>
          <option value="opened">Opened</option>
          <option value="closed">Closed</option>
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={
            filters.excludedFromCommitment == null
              ? ""
              : String(filters.excludedFromCommitment)
          }
          onChange={(event) =>
            onChange({
              excludedFromCommitment:
                event.target.value === ""
                  ? undefined
                  : event.target.value === "true",
              page: 1,
            })
          }
          aria-label="Excluded from commitment"
        >
          <option value="">Excluded from commitment</option>
          <option value="true">Excluded</option>
          <option value="false">Not excluded</option>
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={
            filters.hasRecommendedChanges == null
              ? ""
              : String(filters.hasRecommendedChanges)
          }
          onChange={(event) =>
            onChange({
              hasRecommendedChanges:
                event.target.value === ""
                  ? undefined
                  : event.target.value === "true",
              page: 1,
            })
          }
          aria-label="Has recommended label changes"
        >
          <option value="">Recommended changes</option>
          <option value="true">Has changes</option>
          <option value="false">No changes</option>
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={
            filters.hasEvaluationError == null
              ? ""
              : String(filters.hasEvaluationError)
          }
          onChange={(event) =>
            onChange({
              hasEvaluationError:
                event.target.value === ""
                  ? undefined
                  : event.target.value === "true",
              page: 1,
            })
          }
          aria-label="Evaluation error"
        >
          <option value="">Evaluation error</option>
          <option value="true">Has error</option>
          <option value="false">No error</option>
        </select>
      </div>
    </div>
  );
}
