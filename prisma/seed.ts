import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEAM_MEMBERS = [
  { name: "Saravana Kumar", role: "DEVELOPER" as const, gitlabHandle: "saravana" },
  { name: "Manikandan Prabhu", role: "DEVELOPER" as const, gitlabHandle: "manikandan" },
  { name: "Gowtham Raj", role: "DEVELOPER" as const, gitlabHandle: "gowtham" },
  { name: "Ramanathan", role: "DEVELOPER" as const, gitlabHandle: "ramanathan" },
  { name: "Jawahar", role: "DEVELOPER" as const, gitlabHandle: "jawahar" },
  { name: "Preethi", role: "QA" as const, gitlabHandle: "preethi" },
  { name: "Ruthrakanth", role: "QA" as const, gitlabHandle: "ruthrakanth" },
  { name: "Kadar Selvam", role: "QA" as const, gitlabHandle: "kadar" },
];

const PROJECTS = [
  {
    name: "Release Observations",
    slug: "release-observations",
    description: "Release observation and delivery tracking platform",
    columns: [
      { name: "Backlog", slug: "backlog", position: 0 },
      { name: "Ready", slug: "ready", position: 1 },
      { name: "In Progress", slug: "in-progress", position: 2 },
      { name: "Review", slug: "review", position: 3 },
      { name: "QA", slug: "qa", position: 4 },
      { name: "Done", slug: "done", position: 5 },
    ],
  },
  {
    name: "Admin",
    slug: "admin",
    description: "Administrative and governance platform",
    columns: [
      { name: "Triage", slug: "triage", position: 0 },
      { name: "Planned", slug: "planned", position: 1 },
      { name: "Development", slug: "development", position: 2 },
      { name: "Code Review", slug: "code-review", position: 3 },
      { name: "Testing", slug: "testing", position: 4 },
      { name: "Released", slug: "released", position: 5 },
    ],
  },
];

const GOVERNANCE_RULES = [
  {
    name: "Missing Estimate",
    slug: "missing-estimate",
    category: "planning",
    severity: "warning",
    description: "Work items must have story point estimates",
  },
  {
    name: "Missing Priority",
    slug: "missing-priority",
    category: "planning",
    severity: "warning",
    description: "Work items must have a priority assigned",
  },
  {
    name: "Missing Labels",
    slug: "missing-labels",
    category: "hygiene",
    severity: "info",
    description: "Work items should have at least one label",
  },
  {
    name: "Missing Due Date",
    slug: "missing-due-date",
    category: "planning",
    severity: "warning",
    description: "High priority items require due dates",
  },
  {
    name: "Oversized Story",
    slug: "oversized-story",
    category: "planning",
    severity: "error",
    description: "Stories exceeding 8 points should be split",
    config: { maxStoryPoints: 8 },
  },
  {
    name: "Inactive Issue",
    slug: "inactive-issue",
    category: "activity",
    severity: "warning",
    description: "Issues with no activity for 5+ days",
    config: { inactiveDays: 5 },
  },
  {
    name: "Failed Pipeline",
    slug: "failed-pipeline",
    category: "quality",
    severity: "error",
    description: "Merge requests with failed CI pipelines",
  },
];

async function main() {
  console.log("Seeding Engineering Manager OS...");

  const team = await prisma.team.upsert({
    where: { slug: "engineering" },
    update: {},
    create: {
      name: "Engineering Team",
      slug: "engineering",
    },
  });

  for (const member of TEAM_MEMBERS) {
    await prisma.teamMember.upsert({
      where: {
        teamId_email: {
          teamId: team.id,
          email: `${member.gitlabHandle}@emos.local`,
        },
      },
      update: { name: member.name, role: member.role },
      create: {
        teamId: team.id,
        name: member.name,
        email: `${member.gitlabHandle}@emos.local`,
        role: member.role,
        gitlabHandle: member.gitlabHandle,
        capacity: 40,
      },
    });
  }

  for (const projectDef of PROJECTS) {
    const project = await prisma.gitLabProject.upsert({
      where: { slug: projectDef.slug },
      update: { name: projectDef.name, description: projectDef.description },
      create: {
        name: projectDef.name,
        slug: projectDef.slug,
        description: projectDef.description,
        defaultBranch: "main",
      },
    });

    const workflow = await prisma.projectWorkflow.upsert({
      where: { projectId: project.id },
      update: { name: `${projectDef.name} Workflow` },
      create: {
        projectId: project.id,
        name: `${projectDef.name} Workflow`,
        isDefault: true,
      },
    });

    for (const col of projectDef.columns) {
      await prisma.workflowColumn.upsert({
        where: {
          workflowId_slug: {
            workflowId: workflow.id,
            slug: col.slug,
          },
        },
        update: { name: col.name, position: col.position },
        create: {
          workflowId: workflow.id,
          name: col.name,
          slug: col.slug,
          position: col.position,
        },
      });
    }
  }

  const releaseObsProject = await prisma.gitLabProject.findUniqueOrThrow({
    where: { slug: "release-observations" },
  });

  const now = new Date();
  const sprintStart = new Date(now);
  sprintStart.setDate(sprintStart.getDate() - 7);
  const sprintEnd = new Date(now);
  sprintEnd.setDate(sprintEnd.getDate() + 7);

  await prisma.sprint.upsert({
    where: { id: "seed-sprint-active" },
    update: {},
    create: {
      id: "seed-sprint-active",
      teamId: team.id,
      projectId: releaseObsProject.id,
      name: "Sprint 24 — Release 1.8",
      goal: "Complete release observation sync and admin governance features",
      startDate: sprintStart,
      endDate: sprintEnd,
      isActive: true,
    },
  });

  await prisma.release.upsert({
    where: {
      projectId_version: {
        projectId: releaseObsProject.id,
        version: "1.8.0",
      },
    },
    update: {},
    create: {
      projectId: releaseObsProject.id,
      version: "1.8.0",
      name: "Release 1.8 — Governance & Observations",
      targetDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  for (const rule of GOVERNANCE_RULES) {
    await prisma.governanceRule.upsert({
      where: { slug: rule.slug },
      update: rule,
      create: rule,
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
