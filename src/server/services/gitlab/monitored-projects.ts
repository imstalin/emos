import type { Prisma } from "@prisma/client";

import { getMonitoredGitLabProjectIds } from "@/lib/gitlab-config";
import { db } from "@/lib/db";

export function mergeWorkItemWhere(
  base: Prisma.WorkItemWhereInput,
  extra: Prisma.WorkItemWhereInput,
): Prisma.WorkItemWhereInput {
  if (Object.keys(extra).length === 0) return base;
  return { AND: [base, extra] };
}

export async function getMonitoredProjectDbIds(): Promise<string[] | null> {
  const gitlabIds = getMonitoredGitLabProjectIds();
  if (!gitlabIds) return null;

  const projects = await db.gitLabProject.findMany({
    where: { gitlabId: { in: gitlabIds } },
    select: { id: true },
  });

  return projects.map((project) => project.id);
}

export async function buildMonitoredProjectWhere(): Promise<Prisma.WorkItemWhereInput> {
  const dbIds = await getMonitoredProjectDbIds();
  if (!dbIds) return {};
  return { projectId: { in: dbIds } };
}

export async function getMonitoredProjectLabels(): Promise<
  Array<{ gitlabId: number; name: string }>
> {
  const gitlabIds = getMonitoredGitLabProjectIds();
  if (!gitlabIds) return [];

  const projects = await db.gitLabProject.findMany({
    where: { gitlabId: { in: gitlabIds } },
    select: { name: true, gitlabId: true },
  });
  const nameByGitlabId = new Map(
    projects.map((project) => [project.gitlabId, project.name]),
  );

  return gitlabIds.map((gitlabId) => ({
    gitlabId,
    name: nameByGitlabId.get(gitlabId) ?? `Project ${gitlabId}`,
  }));
}
