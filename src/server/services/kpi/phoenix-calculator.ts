import type { PhoenixKpiDocument, PhoenixKpiRow } from "@/domain/types/phoenix-kpi";
import { db } from "@/lib/db";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

import { computeYtdScore } from "@/domain/kpi/phoenix-kpi-utils";

import {
  MEMBER_KPI_DEFINITIONS,
  computeMetricById,
  computeTeamUtilization,
  monthRange,
  type WorkItemRecord,
} from "./phoenix-kpi-metrics";

function findRow(
  document: PhoenixKpiDocument,
  matchers: string[],
): PhoenixKpiRow | undefined {
  return document.rows.find((row) =>
    matchers.some((matcher) =>
      row.kpi.toLowerCase().includes(matcher.toLowerCase()),
    ),
  );
}

function updateRowMonth(
  row: PhoenixKpiRow,
  monthKey: string,
  score: number | null,
  evidence: string,
): PhoenixKpiRow {
  return {
    ...row,
    monthly: row.monthly.map((month) =>
      month.monthKey === monthKey
        ? {
            ...month,
            score,
            automated: score !== null,
            evidence,
            remarks: evidence,
          }
        : month,
    ),
  };
}

export async function automatePhoenixDocument(
  document: PhoenixKpiDocument,
): Promise<{
  document: PhoenixKpiDocument;
  updatedKpis: string[];
  skippedKpis: string[];
}> {
  const monitoredWhere = await buildMonitoredProjectWhere();

  const items = (await db.workItem.findMany({
    where: mergeWorkItemWhere({}, monitoredWhere),
    select: {
      id: true,
      type: true,
      state: true,
      labels: true,
      storyPoints: true,
      dueDate: true,
      lastActivityAt: true,
      updatedAt: true,
      createdAt: true,
      assigneeId: true,
      reviewerId: true,
    },
  })) as WorkItemRecord[];

  const members = await db.teamMember.findMany({
    where: { isActive: true },
    select: { id: true, capacity: true },
  });

  const updatedKpis: string[] = [];
  const skippedKpis: string[] = [];

  let nextDocument = { ...document };

  for (const month of document.months) {
    const { start, end, key } = monthRange(month);

    for (const definition of MEMBER_KPI_DEFINITIONS) {
      const teamRow = findRow(nextDocument, definition.matchers);
      if (!teamRow?.applicable) continue;

      const result =
        definition.id === "utilization"
          ? computeTeamUtilization(items, start, end, members)
          : computeMetricById(definition.id, items, start, end);
      if (!result) continue;

      nextDocument = {
        ...nextDocument,
        rows: nextDocument.rows.map((row) =>
          row.id === teamRow.id
            ? updateRowMonth(row, key, result.score, result.evidence)
            : row,
        ),
      };
      updatedKpis.push(teamRow.kpi);
    }
  }

  for (const row of nextDocument.rows) {
    if (!row.applicable) {
      skippedKpis.push(row.kpi);
    }
  }

  nextDocument = {
    ...nextDocument,
    rows: nextDocument.rows.map((row) => ({
      ...row,
      ytdScore: computeYtdScore(row),
    })),
  };

  return {
    document: nextDocument,
    updatedKpis: [...new Set(updatedKpis)],
    skippedKpis: [...new Set(skippedKpis)].filter(
      (kpi) => !updatedKpis.includes(kpi),
    ),
  };
}

export function buildDemoAutomatedDocument(
  document: PhoenixKpiDocument,
): PhoenixKpiDocument {
  const now = new Date();
  const demoRows = document.rows.map((row) => {
    if (!row.applicable) return row;

    const monthly = row.monthly.map((month, index) => {
      const monthDate = new Date(document.months[index]?.endDate ?? now);
      if (monthDate > now) {
        return { ...month, score: null, automated: false, evidence: null };
      }

      const base = 88 + (index % 4) * 3;
      return {
        ...month,
        score: Math.round((base + (index % 5)) * 100) / 100,
        automated: true,
        evidence: "Demo: simulated from GitLab activity patterns",
        remarks: "Demo: simulated from GitLab activity patterns",
      };
    });

    return {
      ...row,
      monthly,
      ytdScore: computeYtdScore({ ...row, monthly }),
    };
  });

  return { ...document, rows: demoRows };
}
