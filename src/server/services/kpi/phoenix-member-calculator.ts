import type { PhoenixKpiDocument } from "@/domain/types/phoenix-kpi";
import { computeYtdScore } from "@/domain/kpi/phoenix-kpi-utils";
import type {
  PhoenixMemberKpiMetricRow,
  PhoenixMemberKpiReport,
} from "@/domain/types/phoenix-kpi";
import { db } from "@/lib/db";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

import {
  MEMBER_KPI_DEFINITIONS,
  computeMetricById,
  monthRange,
  type WorkItemRecord,
} from "./phoenix-kpi-metrics";

function findApplicableKpiIds(document: PhoenixKpiDocument): string[] {
  const applicable: string[] = [];
  for (const definition of MEMBER_KPI_DEFINITIONS) {
    const teamRow = document.rows.find((row) =>
      definition.matchers.some((matcher) =>
        row.kpi.toLowerCase().includes(matcher.toLowerCase()),
      ),
    );
    if (teamRow?.applicable) {
      applicable.push(definition.id);
    }
  }
  return applicable;
}

export async function buildPhoenixMemberReport(
  document: PhoenixKpiDocument,
): Promise<PhoenixMemberKpiReport> {
  const monitoredWhere = await buildMonitoredProjectWhere();

  const items = await db.workItem.findMany({
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
  }) as WorkItemRecord[];

  const members = await db.teamMember.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      capacity: true,
      gitlabHandle: true,
    },
  });

  const applicableMetricIds = findApplicableKpiIds(document);

  const memberReports = members.map((member) => {
    const rows: PhoenixMemberKpiMetricRow[] = MEMBER_KPI_DEFINITIONS
      .filter((definition) => applicableMetricIds.includes(definition.id))
      .map((definition) => {
        const monthly = document.months.map((month) => {
          const { start, end, key } = monthRange(month);
          const result = computeMetricById(
            definition.id,
            items,
            start,
            end,
            member.id,
            member.capacity,
          );
          if (!result) {
            return {
              monthKey: key,
              remarks: null,
              score: null,
              automated: false,
              evidence: null,
            };
          }
          return {
            monthKey: key,
            remarks: result.evidence,
            score: result.score,
            automated: result.score !== null,
            evidence: result.evidence,
          };
        });

        const row: PhoenixMemberKpiMetricRow = {
          kpiId: definition.id,
          category: definition.category,
          kpi: definition.kpi,
          monthly,
          ytdScore: computeYtdScore({
            id: definition.id,
            category: definition.category,
            kpi: definition.kpi,
            applicable: true,
            measure: null,
            definitionRemarks: null,
            unit: null,
            benchmark: null,
            targetScore: null,
            ytdScore: null,
            monthly,
          }),
        };
        return row;
      });

    return {
      memberId: member.id,
      name: member.name,
      role: member.role,
      gitlabHandle: member.gitlabHandle,
      capacityWeekly: member.capacity,
      rows,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    months: document.months,
    members: memberReports,
  };
}
