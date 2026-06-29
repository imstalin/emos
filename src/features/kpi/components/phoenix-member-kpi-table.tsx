"use client";

import type {
  PhoenixMemberKpi,
  PhoenixMemberKpiReport,
} from "@/domain/types/phoenix-kpi";

interface PhoenixMemberKpiTableProps {
  member: PhoenixMemberKpi;
  months: PhoenixMemberKpiReport["months"];
}

export function PhoenixMemberKpiTable({
  member,
  months,
}: PhoenixMemberKpiTableProps) {
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
              YTD
            </th>
            {months.map((month) => (
              <th
                key={month.key}
                className="border border-[#D9D9D9] px-3 py-2 text-center font-semibold whitespace-nowrap"
              >
                {month.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {member.rows.map((row) => (
            <tr key={row.kpiId} className="hover:bg-muted/40">
              <td className="border border-[#E8E8E8] px-3 py-2 align-top text-muted-foreground">
                {row.category ?? ""}
              </td>
              <td className="border border-[#E8E8E8] px-3 py-2 align-top font-medium">
                {row.kpi}
              </td>
              <td className="border border-[#E8E8E8] px-3 py-2 align-top font-semibold">
                {row.ytdScore ?? "—"}
              </td>
              {row.monthly.map((month) => (
                <td
                  key={`${row.kpiId}-${month.monthKey}`}
                  className="border border-[#E8E8E8] px-3 py-2 align-top text-center"
                  title={month.evidence ?? undefined}
                >
                  <span className="font-medium">
                    {month.score !== null ? month.score : "—"}
                  </span>
                  {month.evidence ? (
                    <p className="mt-1 text-left text-xs text-muted-foreground line-clamp-2">
                      {month.evidence}
                    </p>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
