"use client";

import type { SprintMetrics } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

const WORK_TYPES: Array<{ key: keyof SprintMetrics; label: string }> = [
  { key: "regressionCount", label: "Regression" },
  { key: "bugCount", label: "Bug" },
  { key: "enhancementCount", label: "Enhancement" },
  { key: "supportCount", label: "Support" },
  { key: "hotfixCount", label: "Hotfix" },
  { key: "technicalDebtCount", label: "Technical debt" },
  { key: "uatCount", label: "UAT" },
  { key: "releaseValidationCount", label: "Release validation" },
  { key: "deploymentCount", label: "Deployment" },
];

export function WorkTypeChart({ metrics }: { metrics: SprintMetrics | undefined }) {
  const m = metrics ?? {};
  const rows = WORK_TYPES.map((item) => ({
    label: item.label,
    value: Number(m[item.key] ?? 0),
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section
      className="rounded-xl border border-border p-4"
      aria-labelledby="si-worktype-chart"
    >
      <h3 id="si-worktype-chart" className="mb-3 text-sm font-medium">
        Work Type Distribution
      </h3>
      <ul className="space-y-2">
        {rows.map((row) => {
          const width = Math.round((row.value / max) * 100);
          const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <li key={row.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-xs">
              <span>{row.label}</span>
              <div
                className="h-2 rounded-full bg-muted"
                role="img"
                aria-label={`${row.label}: ${row.value} (${pct} percent)`}
              >
                <div
                  className="h-2 rounded-full bg-primary/70"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-right tabular-nums">{row.value}</span>
            </li>
          );
        })}
      </ul>
      {total === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No work-type metrics available for this run.
        </p>
      ) : null}
    </section>
  );
}
