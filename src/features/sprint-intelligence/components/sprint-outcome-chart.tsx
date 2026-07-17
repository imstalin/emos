"use client";

import type { SprintMetrics } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

function BarRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span>
          {value} ({pct}%)
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${value} of ${total} (${pct} percent)`}
      >
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SprintOutcomeChart({
  metrics,
  unableToDetermine,
}: {
  metrics: SprintMetrics | undefined;
  unableToDetermine: number;
}) {
  const m = metrics ?? {};
  const planned = m.plannedCount ?? 0;
  const unplanned = m.unplannedCount ?? 0;
  const planningTotal = planned + unplanned + unableToDetermine;

  const committed = m.committedCount ?? 0;
  const spillover = m.spilloverCount ?? 0;
  const completedUnplanned = m.completedUnplannedCount ?? 0;
  const openUnplanned = Math.max(
    0,
    (m.unplannedCount ?? 0) - (m.completedUnplannedCount ?? 0),
  );
  const deliveryTotal =
    committed + spillover + completedUnplanned + openUnplanned;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section
        className="rounded-xl border border-border p-4"
        aria-labelledby="si-planning-chart"
      >
        <h3 id="si-planning-chart" className="mb-3 text-sm font-medium">
          Planned vs Unplanned
        </h3>
        <div className="space-y-3">
          <BarRow
            label="Planned"
            value={planned}
            total={planningTotal}
            color="bg-emerald-500"
          />
          <BarRow
            label="Unplanned"
            value={unplanned}
            total={planningTotal}
            color="bg-sky-500"
          />
          <BarRow
            label="Unable to determine"
            value={unableToDetermine}
            total={planningTotal}
            color="bg-orange-400"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Totals: {planningTotal} classified issues
        </p>
      </section>

      <section
        className="rounded-xl border border-border p-4"
        aria-labelledby="si-delivery-chart"
      >
        <h3 id="si-delivery-chart" className="mb-3 text-sm font-medium">
          Delivery Outcome
        </h3>
        <div className="space-y-3">
          <BarRow
            label="Committed"
            value={committed}
            total={deliveryTotal}
            color="bg-emerald-500"
          />
          <BarRow
            label="Spillover"
            value={spillover}
            total={deliveryTotal}
            color="bg-amber-500"
          />
          <BarRow
            label="Completed unplanned"
            value={completedUnplanned}
            total={deliveryTotal}
            color="bg-sky-500"
          />
          <BarRow
            label="Open unplanned"
            value={openUnplanned}
            total={deliveryTotal}
            color="bg-slate-400"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Commitment reliability uses eligible planned issues only.
        </p>
      </section>
    </div>
  );
}
