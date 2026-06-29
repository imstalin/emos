import type {
  DashboardMetrics,
  ReleaseHealth,
  SprintHealth,
  TeamMemberSummary,
  WorkItemSummary,
} from "@/domain/types/dashboard";
import {
  classifyProductBacklog,
  partitionProductBacklog,
} from "@/domain/backlog/classify-product-backlog";

const now = new Date();

function daysFromNow(days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgo(days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function withBacklogMeta(
  item: Omit<WorkItemSummary, "milestoneTitle" | "backlogCategory"> &
    Partial<Pick<WorkItemSummary, "milestoneTitle">>,
): WorkItemSummary {
  const milestoneTitle = item.milestoneTitle ?? null;
  return {
    ...item,
    milestoneTitle,
    backlogCategory: classifyProductBacklog(milestoneTitle, item.labels),
  };
}

const DEMO_WORK_ITEMS: WorkItemSummary[] = [
  withBacklogMeta({
    id: "wi-1",
    title: "Implement release observation pipeline sync",
    type: "ISSUE",
    state: "IN_PROGRESS",
    priority: "HIGH",
    health: "HEALTHY",
    assigneeName: "Saravana Kumar",
    projectName: "Release Observations",
    dueDate: daysFromNow(3),
    labels: ["backend", "sync"],
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-2",
    title: "Admin user role permission matrix",
    type: "ISSUE",
    state: "IN_REVIEW",
    priority: "HIGH",
    health: "AT_RISK",
    assigneeName: "Manikandan Prabhu",
    projectName: "Admin",
    dueDate: daysFromNow(1),
    labels: ["security", "admin"],
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-3",
    title: "Fix mobile dashboard rendering on iOS",
    type: "ISSUE",
    state: "BLOCKED",
    priority: "CRITICAL",
    health: "CRITICAL",
    assigneeName: "Gowtham Raj",
    projectName: "Release Observations",
    dueDate: daysFromNow(-1),
    labels: ["mobile", "bug"],
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-4",
    title: "Add governance score aggregation",
    type: "MERGE_REQUEST",
    state: "IN_REVIEW",
    priority: "MEDIUM",
    health: "HEALTHY",
    assigneeName: "Ramanathan",
    projectName: "Admin",
    dueDate: daysFromNow(5),
    labels: ["governance"],
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-5",
    title: "QA regression suite for release 1.8",
    type: "ISSUE",
    state: "QA",
    priority: "HIGH",
    health: "AT_RISK",
    assigneeName: "Preethi",
    projectName: "Release Observations",
    dueDate: daysFromNow(2),
    labels: ["qa", "release-1.8"],
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-6",
    title: "Production: API timeout on report export",
    type: "ISSUE",
    state: "OPEN",
    priority: "CRITICAL",
    health: "CRITICAL",
    assigneeName: "Jawahar",
    projectName: "Release Observations",
    dueDate: daysFromNow(0),
    labels: ["production", "api"],
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-7",
    title: "Backlog: observation export filters",
    type: "ISSUE",
    state: "OPEN",
    priority: "MEDIUM",
    health: "HEALTHY",
    assigneeName: "Saravana Kumar",
    projectName: "Release Observations",
    dueDate: daysFromNow(10),
    labels: ["Type::Task", "priority::medium"],
    milestoneTitle: "Backlog",
    webUrl: null,
  }),
  withBacklogMeta({
    id: "wi-8",
    title: "Backlog: chart legend missing on mobile",
    type: "ISSUE",
    state: "OPEN",
    priority: "HIGH",
    health: "AT_RISK",
    assigneeName: "Gowtham Raj",
    projectName: "Release Observations",
    dueDate: daysFromNow(7),
    labels: ["Type::Defect", "site::mobile", "priority::high"],
    milestoneTitle: "Backlog",
    webUrl: null,
  }),
];

const DEMO_MEMBERS: TeamMemberSummary[] = [
  {
    id: "m-1",
    name: "Saravana Kumar",
    role: "DEVELOPER",
    capacity: 40,
    assignedPoints: 13,
    activeItems: 3,
    health: "HEALTHY",
    lastActivityAt: daysAgo(0),
  },
  {
    id: "m-2",
    name: "Manikandan Prabhu",
    role: "DEVELOPER",
    capacity: 40,
    assignedPoints: 21,
    activeItems: 4,
    health: "AT_RISK",
    lastActivityAt: daysAgo(0),
  },
  {
    id: "m-3",
    name: "Gowtham Raj",
    role: "DEVELOPER",
    capacity: 40,
    assignedPoints: 18,
    activeItems: 2,
    health: "CRITICAL",
    lastActivityAt: daysAgo(2),
  },
  {
    id: "m-4",
    name: "Ramanathan",
    role: "DEVELOPER",
    capacity: 40,
    assignedPoints: 8,
    activeItems: 2,
    health: "HEALTHY",
    lastActivityAt: daysAgo(1),
  },
  {
    id: "m-5",
    name: "Jawahar",
    role: "DEVELOPER",
    capacity: 40,
    assignedPoints: 15,
    activeItems: 3,
    health: "AT_RISK",
    lastActivityAt: daysAgo(0),
  },
  {
    id: "m-6",
    name: "Preethi",
    role: "QA",
    capacity: 40,
    assignedPoints: 12,
    activeItems: 4,
    health: "HEALTHY",
    lastActivityAt: daysAgo(0),
  },
  {
    id: "m-7",
    name: "Ruthrakanth",
    role: "QA",
    capacity: 40,
    assignedPoints: 10,
    activeItems: 3,
    health: "HEALTHY",
    lastActivityAt: daysAgo(1),
  },
  {
    id: "m-8",
    name: "Kadar Selvam",
    role: "QA",
    capacity: 40,
    assignedPoints: 8,
    activeItems: 2,
    health: "HEALTHY",
    lastActivityAt: daysAgo(0),
  },
];

const DEMO_SPRINT: SprintHealth = {
  id: "sprint-1",
  name: "Sprint 24 — Release 1.8",
  goal: "Complete release observation sync and admin governance features",
  startDate: daysAgo(7),
  endDate: daysFromNow(7),
  completedPoints: 34,
  totalPoints: 68,
  velocity: 32,
  health: "AT_RISK",
  daysRemaining: 7,
};

const DEMO_RELEASES: ReleaseHealth[] = [
  {
    id: "rel-1",
    version: "1.8.0",
    name: "Release 1.8 — Governance & Observations",
    projectName: "Release Observations",
    targetDate: daysFromNow(14),
    openItems: 12,
    blockedItems: 2,
    health: "AT_RISK",
    progressPercent: 58,
  },
  {
    id: "rel-2",
    version: "2.1.0",
    name: "Admin 2.1 — Role Matrix",
    projectName: "Admin",
    targetDate: daysFromNow(21),
    openItems: 8,
    blockedItems: 0,
    health: "HEALTHY",
    progressPercent: 72,
  },
];

export function getDemoDashboardMetrics(): DashboardMetrics {
  const blockers = DEMO_WORK_ITEMS.filter((w) => w.state === "BLOCKED");
  const highPriority = DEMO_WORK_ITEMS.filter(
    (w) => w.priority === "CRITICAL" || w.priority === "HIGH",
  );
  const pendingReviews = DEMO_WORK_ITEMS.filter((w) => w.state === "IN_REVIEW");
  const qaItems = DEMO_WORK_ITEMS.filter(
    (w) => w.state === "QA" || w.labels.includes("qa"),
  );
  const productionIssues = DEMO_WORK_ITEMS.filter((w) =>
    w.labels.includes("production"),
  );
  const openItems = DEMO_WORK_ITEMS.filter(
    (w) => w.state !== "DONE" && w.state !== "CLOSED",
  );
  const productBacklog = partitionProductBacklog(openItems);
  const totalCapacity = DEMO_MEMBERS.reduce((sum, m) => sum + m.capacity, 0);
  const allocatedPoints = DEMO_MEMBERS.reduce(
    (sum, m) => sum + m.assignedPoints,
    0,
  );

  return {
    generatedAt: now.toISOString(),
    teamStatus: {
      totalMembers: DEMO_MEMBERS.length,
      activeMembers: DEMO_MEMBERS.filter((m) => m.activeItems > 0).length,
      developers: DEMO_MEMBERS.filter((m) => m.role === "DEVELOPER").length,
      qaMembers: DEMO_MEMBERS.filter((m) => m.role === "QA").length,
      overallHealth: "AT_RISK",
    },
    currentWork: DEMO_WORK_ITEMS.filter(
      (w) => w.state === "IN_PROGRESS" || w.state === "OPEN",
    ),
    blockers,
    highPriority,
    releaseHealth: DEMO_RELEASES,
    sprintHealth: DEMO_SPRINT,
    pendingReviews,
    qaStatus: {
      inQa: qaItems.filter((w) => w.state === "QA").length,
      awaitingQa: 3,
      failedQa: 1,
      items: qaItems,
    },
    productionIssues,
    productBacklog,
    workload: DEMO_MEMBERS,
    teamCapacity: {
      totalCapacity,
      allocatedPoints,
      utilizationPercent: Math.round((allocatedPoints / totalCapacity) * 100),
      membersOverCapacity: DEMO_MEMBERS.filter(
        (m) => m.assignedPoints > m.capacity * 0.5,
      ).length,
    },
  };
}
