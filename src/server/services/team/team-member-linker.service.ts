import type { GitLabUser } from "@/domain/types/gitlab";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function linkTeamMembersToGitLab(
  gitlabUsers: GitLabUser[],
): Promise<number> {
  const members = await db.teamMember.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      gitlabUserId: true,
      gitlabHandle: true,
    },
  });

  let linked = 0;

  for (const member of members) {
    const match = findGitLabUserMatch(member, gitlabUsers);
    if (!match) continue;

    if (member.gitlabUserId === match.id) continue;

    await db.teamMember.update({
      where: { id: member.id },
      data: {
        gitlabUserId: match.id,
        gitlabHandle: match.username,
      },
    });

    linked += 1;
    logger.info("Linked team member to GitLab user", {
      member: member.name,
      gitlabUsername: match.username,
      gitlabUserId: match.id,
    });
  }

  return linked;
}

function findGitLabUserMatch(
  member: {
    name: string;
    gitlabUserId: number | null;
    gitlabHandle: string | null;
  },
  gitlabUsers: GitLabUser[],
): GitLabUser | null {
  if (member.gitlabUserId != null) {
    const byId = gitlabUsers.find((user) => user.id === member.gitlabUserId);
    if (byId) return byId;
  }

  if (member.gitlabHandle) {
    const handle = member.gitlabHandle.toLowerCase();
    const exact = gitlabUsers.find(
      (user) => user.username.toLowerCase() === handle,
    );
    if (exact) return exact;

    const partial = gitlabUsers.find((user) =>
      user.username.toLowerCase().includes(handle),
    );
    if (partial) return partial;
  }

  const normalizedMemberName = member.name.toLowerCase().trim();
  const byFullName = gitlabUsers.find(
    (user) => user.name.toLowerCase().trim() === normalizedMemberName,
  );
  if (byFullName) return byFullName;

  const firstName = normalizedMemberName.split(/\s+/)[0];
  if (firstName.length >= 3) {
    const byFirstName = gitlabUsers.find((user) => {
      const gitlabName = user.name.toLowerCase();
      return (
        gitlabName.startsWith(firstName) ||
        gitlabName.includes(firstName) ||
        user.username.toLowerCase().includes(firstName)
      );
    });
    if (byFirstName) return byFirstName;
  }

  return null;
}
