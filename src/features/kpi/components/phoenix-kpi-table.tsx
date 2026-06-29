"use client";

import { Fragment } from "react";

import type { PhoenixKpiData, PhoenixKpiRow } from "@/domain/types/phoenix-kpi";

interface PhoenixKpiTableProps {
  data: PhoenixKpiData;
  onRowChange: (rowId: string, updates: Partial<PhoenixKpiRow>) => void;
}

export function PhoenixKpiTable({ data, onRowChange }: PhoenixKpiTableProps) {
  const { document } = data;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-[#4472C4] text-left text-white">
            <th className="border border-[#D9D9D9] px-3 py-2 font-semibold">
              Category
            </th>
            <th className="border border-[#D9D9D9] px-3 py-2 font-semibold">
              KPI
            </th>
            <th className="border border-[#D9D9D9] px-3 py-2 font-semibold">
              Applicable
            </th>
            <th className="border border-[#D9D9D9] px-3 py-2 font-semibold">
              YTD
            </th>
            {document.months.map((month) => (
              <th
                key={month.key}
                colSpan={2}
                className="border border-[#D9D9D9] px-3 py-2 text-center font-semibold"
              >
                {month.label}
              </th>
            ))}
          </tr>
          <tr className="bg-[#4472C4] text-left text-xs text-white">
            <th className="border border-[#D9D9D9] px-3 py-1" colSpan={3} />
            <th className="border border-[#D9D9D9] px-3 py-1">Score</th>
            {document.months.map((month) => (
              <Fragment key={month.key}>
                <th className="border border-[#D9D9D9] px-2 py-1">Remarks</th>
                <th className="border border-[#D9D9D9] px-2 py-1">Score</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {document.rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/40">
              <td className="border border-[#E8E8E8] px-3 py-2 align-top text-muted-foreground">
                {row.category ?? ""}
              </td>
              <td className="border border-[#E8E8E8] px-3 py-2 align-top font-medium">
                {row.kpi}
                {row.monthly.some((m) => m.automated) ? (
                  <span className="mt-1 block text-xs text-emerald-600">
                    Auto-calculated
                  </span>
                ) : null}
              </td>
              <td className="border border-[#E8E8E8] px-3 py-2 align-top">
                {row.applicable ? "Yes" : "No"}
              </td>
              <td className="border border-[#E8E8E8] px-3 py-2 align-top font-semibold">
                {row.ytdScore ?? "—"}
              </td>
              {row.monthly.map((month) => (
                <Fragment key={`${row.id}-${month.monthKey}`}>
                  <td className="border border-[#E8E8E8] align-top">
                    <textarea
                      value={month.remarks ?? ""}
                      onChange={(event) => {
                        const monthly = row.monthly.map((item) =>
                          item.monthKey === month.monthKey
                            ? {
                                ...item,
                                remarks: event.target.value || null,
                                automated: false,
                              }
                            : item,
                        );
                        onRowChange(row.id, { monthly });
                      }}
                      rows={2}
                      className="min-h-9 w-full min-w-[10rem] resize-y bg-transparent px-2 py-2 outline-none focus:bg-background"
                    />
                  </td>
                  <td className="border border-[#E8E8E8] align-top">
                    <input
                      type="text"
                      value={month.score ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const score = raw === "" ? null : Number(raw);
                        const monthly = row.monthly.map((item) =>
                          item.monthKey === month.monthKey
                            ? {
                                ...item,
                                score:
                                  score === null || Number.isNaN(score)
                                    ? null
                                    : score,
                                automated: false,
                              }
                            : item,
                        );
                        onRowChange(row.id, { monthly });
                      }}
                      className="w-full min-w-[4rem] bg-transparent px-2 py-2 outline-none focus:bg-background"
                    />
                  </td>
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
