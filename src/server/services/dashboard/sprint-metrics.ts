import type { HealthStatus, Prisma, WorkItem } from "@prisma/client";

import { buildDayOnePlanningSummary } from "@/domain/sprint/planning-capacity";
import { sprintProgress } from "@/domain/workload/compute-workload";
import { DELIVERY_ACTIVE_STATES } from "@/domain/workload/delivery-work";
import type { SprintHealth } from "@/domain/types/dashboard";
import { db } from "@/lib/db";
import { mergeWorkItemWhere } from "@/server/services/gitlab/monitored-projects";

import { buildActiveSprintItemWhere } from "./sprint-scope";

type MonitoredWhere = Prisma.WorkItemWhereInput;

function computeOverallHealth(items: { health: HealthStatus }[]): HealthStatus {
  if (items.some((item) => item.health === "CRITICAL")) return "CRITICAL";
  if (items.some((item) => item.health === "AT_RISK")) return "AT_RISK";
  if (items.length > 0) return "HEALTHY";
  return "UNKNOWN";
}

async function loadSprintItems(
  activeSprint: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  },
  monitoredWhere: MonitoredWhere,
): Promise<{ open: WorkItem[]; completed: WorkItem[] }> {
  const sprintWhere = buildActiveSprintItemWhere(activeSprint, monitoredWhere);

  const [open, completed] = await Promise.all([
    db.workItem.findMany({
      where: mergeWorkItemWhere(
        { state: { notIn: ["DONE", "CLOSED"] } },
        sprintWhere,
      ),
    }),
    db.workItem.findMany({
      where: mergeWorkItemWhere(
        {
          state: "DONE",
          updatedAt: {
            gte: activeSprint.startDate,
            lte: activeSprint.endDate,
          },
        },
        sprintWhere,
      ),
    }),
  ]);

  return { open, completed };
}

export async function buildSprintHealth(
  activeSprint: {
    id: string;
    name: string;
    goal: string | null;
    startDate: Date;
    endDate: Date;
    gitlabMilestoneId?: number | null;
  } | null,
  monitoredWhere: MonitoredWhere,
  planningMembers?: Array<{
    id: string;
    name: string;
    role: "DEVELOPER" | "QA" | "MANAGER";
    capacity: number;
  }>,
): Promise<SprintHealth | null> {
  if (!activeSprint) return null;

  const { open: openItems, completed: completedItems } = await loadSprintItems(
    activeSprint,
    monitoredWhere,
  );

  const inFlightItems = openItems.filter((item) =>
    DELIVERY_ACTIVE_STATES.includes(
      item.state as (typeof DELIVERY_ACTIVE_STATES)[number],
    ),
  );
  const inReviewCount = openItems.filter((item) => item.state === "IN_REVIEW").length;
  const inQaCount = openItems.filter((item) => item.state === "QA").length;
  const qaPairedCount = openItems.filter((item) => item.qaOwnerId != null).length;
  const qaUnassignedCount = openItems.length - qaPairedCount;

  const progress = sprintProgress(openItems, completedItems);
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (activeSprint.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );

  let sprintBalanced = openItems.length <= 15 && qaUnassignedCount === 0;
  if (planningMembers?.length) {
    const dayOne = buildDayOnePlanningSummary(
      planningMembers,
      openItems.length,
      qaPairedCount,
    );
    sprintBalanced = dayOne.sprintBalanced;
  }

  return {
    id: activeSprint.id,
    name: activeSprint.name,
    goal: activeSprint.goal,
    startDate: activeSprint.startDate.toISOString(),
    endDate: activeSprint.endDate.toISOString(),
    completedPoints: progress.completedPoints,
    totalPoints: progress.totalPoints,
    completedItems: progress.completedCount,
    totalItems: progress.totalItems,
    inFlightItems: inFlightItems.length,
    velocity: progress.completedPoints,
    health: computeOverallHealth([...openItems, ...completedItems]),
    daysRemaining,
    loadBasis: progress.loadBasis,
    qaPairedCount,
    qaUnassignedCount,
    inReviewCount,
    inQaCount,
    sprintBalanced,
  };
}
