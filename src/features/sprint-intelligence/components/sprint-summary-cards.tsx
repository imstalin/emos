"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DELIVERY_DEFINITIONS,
  formatPercent,
  PLANNING_DEFINITIONS,
} from "@/features/sprint-intelligence/lib/status-presentation";
import type { SprintMetrics } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

type CardDef = {
  key: string;
  label: string;
  value: string | number;
  definition: string;
  filter?: { planningStatus?: string; deliveryStatus?: string; workType?: string };
};

export function SprintSummaryCards({
  metrics,
  totalIssues,
  unableToDetermine,
  onFilter,
}: {
  metrics: SprintMetrics | undefined;
  totalIssues: number;
  unableToDetermine: number;
  onFilter?: (filter: CardDef["filter"]) => void;
}) {
  const m = metrics ?? {};
  const cards: CardDef[] = [
    {
      key: "total",
      label: "Total Sprint Issues",
      value: totalIssues,
      definition: "Issues evaluated for the selected analysis run.",
    },
    {
      key: "planned",
      label: "Planned",
      value: m.plannedCount ?? 0,
      definition: PLANNING_DEFINITIONS.Planned,
      filter: { planningStatus: "Planned" },
    },
    {
      key: "committed",
      label: "Committed",
      value: m.committedCount ?? 0,
      definition: DELIVERY_DEFINITIONS.Committed,
      filter: { deliveryStatus: "Committed" },
    },
    {
      key: "spillover",
      label: "Spillover",
      value: m.spilloverCount ?? 0,
      definition: DELIVERY_DEFINITIONS.Spillover,
      filter: { deliveryStatus: "Spillover" },
    },
    {
      key: "unplanned",
      label: "Unplanned",
      value: m.unplannedCount ?? 0,
      definition: PLANNING_DEFINITIONS.Unplanned,
      filter: { planningStatus: "Unplanned" },
    },
    {
      key: "completed-unplanned",
      label: "Completed Unplanned",
      value: m.completedUnplannedCount ?? 0,
      definition: DELIVERY_DEFINITIONS.CompletedUnplanned,
      filter: { deliveryStatus: "CompletedUnplanned" },
    },
    {
      key: "regression",
      label: "Regression",
      value: m.regressionCount ?? 0,
      definition: "Issues classified with Regression work type.",
      filter: { workType: "Regression" },
    },
    {
      key: "support",
      label: "Support",
      value: m.supportCount ?? 0,
      definition: "Support work type issues.",
      filter: { workType: "Support" },
    },
    {
      key: "hotfix",
      label: "Hotfix",
      value: m.hotfixCount ?? 0,
      definition: "Hotfix work type issues.",
      filter: { workType: "Hotfix" },
    },
    {
      key: "unable",
      label: "Unable to Determine",
      value: unableToDetermine,
      definition: PLANNING_DEFINITIONS.UnableToDetermine,
      filter: { planningStatus: "UnableToDetermine" },
    },
    {
      key: "reliability",
      label: "Commitment Reliability",
      value: formatPercent(m.commitmentReliabilityPercent),
      definition:
        "Committed eligible planned issues ÷ total eligible planned issues × 100. Excluded support/hotfix/UAT is omitted when configured.",
    },
    {
      key: "unplanned-pct",
      label: "Unplanned Work %",
      value: formatPercent(m.unplannedWorkPercent),
      definition: "Share of sprint issues classified as unplanned.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const clickable = Boolean(card.filter && onFilter);
        return (
          <Card
            key={card.key}
            className={clickable ? "transition hover:border-primary/40" : undefined}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <CardDescription className="sr-only">{card.definition}</CardDescription>
            </CardHeader>
            <CardContent>
              {clickable ? (
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onFilter?.(card.filter)}
                  title={card.definition}
                  aria-label={`Filter issues by ${card.label}`}
                >
                  <p className="text-2xl font-semibold tracking-tight">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {card.definition}
                  </p>
                </button>
              ) : (
                <div title={card.definition}>
                  <p className="text-2xl font-semibold tracking-tight">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {card.definition}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
