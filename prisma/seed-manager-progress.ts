import { PrismaClient } from "@prisma/client";

import { DEFAULT_MANAGER_PROGRESS_CONFIG } from "@/domain/types/manager-progress";
import { PHOENIX_FEED_MEMBERS } from "@/lib/manager-progress-config";

const prisma = new PrismaClient();

const ENGINEERING_PRIORITIES = [
  {
    name: "TSC Production",
    description: "TSC delivery and release validation",
    keywords: ["tsc", "tsc production"],
    priorityOrder: 1,
    targetDaysFromNow: 1,
  },
  {
    name: "Platform Core + Extension",
    description: "Platform core and extension work",
    keywords: ["platform", "extension"],
    priorityOrder: 2,
  },
  {
    name: "Mobile Coupon Claim",
    description: "Mobile coupon claim feature",
    keywords: ["mobile", "coupon"],
    priorityOrder: 3,
  },
  {
    name: "Cash Rewards Phase 2",
    description: "Cash rewards phase 2 delivery",
    keywords: ["cash rewards", "rewards phase 2"],
    priorityOrder: 4,
  },
  {
    name: "Release Observation Issues",
    description: "Release observation backlog",
    keywords: ["release observation", "observations"],
    priorityOrder: 5,
  },
  {
    name: "Salesforce Connector",
    description: "Salesforce connector integration",
    keywords: ["salesforce", "connector"],
    priorityOrder: 6,
  },
  {
    name: "Advanced Search",
    description: "Advanced search integration",
    keywords: ["advanced search", "search"],
    priorityOrder: 7,
  },
  {
    name: "Rewards Expiry",
    description: "Rewards expiry hotfix and validation",
    keywords: ["rewards expiry", "expiry"],
    priorityOrder: 8,
  },
];

async function main() {
  console.log("Seeding manager progress configuration...");

  const teams = {
    core: await prisma.team.upsert({
      where: { slug: "phoenix-core" },
      update: { name: "Phoenix Core" },
      create: { name: "Phoenix Core", slug: "phoenix-core" },
    }),
    qa: await prisma.team.upsert({
      where: { slug: "phoenix-qa" },
      update: { name: "Phoenix QA" },
      create: { name: "Phoenix QA", slug: "phoenix-qa" },
    }),
  };

  for (const seed of PHOENIX_FEED_MEMBERS) {
    const team = seed.teamSlug === "phoenix-core" ? teams.core : teams.qa;
    const member = await prisma.teamMember.upsert({
      where: {
        teamId_email: {
          teamId: team.id,
          email: `${seed.gitlabUsername.toLowerCase()}@emos.local`,
        },
      },
      update: {
        name: seed.name,
        role: seed.role,
        gitlabHandle: seed.gitlabUsername,
        isActive: true,
      },
      create: {
        teamId: team.id,
        name: seed.name,
        email: `${seed.gitlabUsername.toLowerCase()}@emos.local`,
        role: seed.role,
        gitlabHandle: seed.gitlabUsername,
        capacity: 40,
        isActive: true,
      },
    });

    await prisma.gitLabMemberFeed.upsert({
      where: { memberId: member.id },
      update: { feedEnvKey: seed.feedEnvKey, isEnabled: true },
      create: {
        memberId: member.id,
        feedEnvKey: seed.feedEnvKey,
        isEnabled: true,
      },
    });
  }

  for (const priority of ENGINEERING_PRIORITIES) {
    const existing = await prisma.engineeringPriority.findFirst({
      where: { name: priority.name },
    });
    const targetDate =
      priority.targetDaysFromNow != null
        ? new Date(Date.now() + priority.targetDaysFromNow * 86400000)
        : null;

    if (existing) {
      await prisma.engineeringPriority.update({
        where: { id: existing.id },
        data: {
          keywords: priority.keywords,
          priorityOrder: priority.priorityOrder,
          targetDate,
          status: "active",
        },
      });
    } else {
      await prisma.engineeringPriority.create({
        data: {
          name: priority.name,
          description: priority.description,
          teamId: teams.core.id,
          priorityOrder: priority.priorityOrder,
          keywords: priority.keywords,
          targetDate,
          status: "active",
        },
      });
    }
  }

  await prisma.managerProgressConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      config: DEFAULT_MANAGER_PROGRESS_CONFIG as object,
    },
  });

  console.log("Manager progress seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
