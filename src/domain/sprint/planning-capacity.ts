import type { MemberRole } from "@prisma/client";

/** Dev: ~8 concurrent items per person (capacity 40 ÷ 5). */
const DEV_CAPACITY_DIVISOR = 5;

/** QA: ~5 testable items per person per sprint (capacity 40 ÷ 8). */
const QA_CAPACITY_DIVISOR = 8;

export interface PlanningMember {
  id: string;
  name: string;
  role: MemberRole;
  capacity: number;
}

export interface RolePlanningCapacity {
  role: "DEVELOPER" | "QA";
  memberCount: number;
  totalCapacity: number;
  wipLimit: number;
  plannedItems: number;
  utilizationPercent: number;
}

export interface DayOnePlanningSummary {
  dev: RolePlanningCapacity;
  qa: RolePlanningCapacity;
  qaPairedInActiveSprint: number;
  qaUnassignedInActiveSprint: number;
  sprintBalanced: boolean;
  bottleneck: "dev" | "qa" | "balanced";
}

export function wipLimitForPlanningRole(
  capacity: number,
  role: MemberRole,
): number {
  const divisor = role === "QA" ? QA_CAPACITY_DIVISOR : DEV_CAPACITY_DIVISOR;
  return Math.max(1, Math.round(capacity / divisor));
}

export function buildRolePlanningCapacity(
  members: PlanningMember[],
  role: "DEVELOPER" | "QA",
  plannedItems: number,
): RolePlanningCapacity {
  const roleMembers = members.filter((member) => member.role === role);
  const wipLimit = roleMembers.reduce(
    (sum, member) => sum + wipLimitForPlanningRole(member.capacity, member.role),
    0,
  );
  const totalCapacity = roleMembers.reduce(
    (sum, member) => sum + member.capacity,
    0,
  );

  return {
    role,
    memberCount: roleMembers.length,
    totalCapacity,
    wipLimit,
    plannedItems,
    utilizationPercent:
      wipLimit > 0 ? Math.min(100, Math.round((plannedItems / wipLimit) * 100)) : 0,
  };
}

export function buildDayOnePlanningSummary(
  members: PlanningMember[],
  activeSprintItemCount: number,
  qaPairedCount: number,
): DayOnePlanningSummary {
  const dev = buildRolePlanningCapacity(members, "DEVELOPER", activeSprintItemCount);
  const qa = buildRolePlanningCapacity(members, "QA", qaPairedCount);
  const qaUnassigned = Math.max(0, activeSprintItemCount - qaPairedCount);

  const devRatio = dev.wipLimit > 0 ? activeSprintItemCount / dev.wipLimit : 0;
  const qaRatio = qa.wipLimit > 0 ? activeSprintItemCount / qa.wipLimit : 0;

  let bottleneck: DayOnePlanningSummary["bottleneck"] = "balanced";
  if (qaRatio > devRatio + 0.1) bottleneck = "qa";
  else if (devRatio > qaRatio + 0.1) bottleneck = "dev";

  const sprintBalanced =
    activeSprintItemCount <= dev.wipLimit &&
    activeSprintItemCount <= qa.wipLimit &&
    qaUnassigned === 0;

  return {
    dev,
    qa,
    qaPairedInActiveSprint: qaPairedCount,
    qaUnassignedInActiveSprint: qaUnassigned,
    sprintBalanced,
    bottleneck,
  };
}

export function recommendedDevSprintItems(members: PlanningMember[]): number {
  const dev = buildRolePlanningCapacity(members, "DEVELOPER", 0);
  const qa = buildRolePlanningCapacity(members, "QA", 0);
  return Math.max(1, Math.min(dev.wipLimit, qa.wipLimit));
}
