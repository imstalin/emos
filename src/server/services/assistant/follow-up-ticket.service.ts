import type { FollowUpTicketContext } from "@/domain/types/follow-up-ticket";
import { getGitLabConfig } from "@/lib/gitlab-config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";

const MAX_COMMENTS = 25;
const MAX_BODY_LENGTH = 2000;

function trimText(text: string | null | undefined, max = MAX_BODY_LENGTH): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export class FollowUpTicketService {
  async getTicketContext(followUpId: string): Promise<FollowUpTicketContext | null> {
    const followUp = await followUpsService.getItemById(followUpId);
    if (!followUp?.workItemId) return null;

    const workItem = await db.workItem.findUnique({
      where: { id: followUp.workItemId },
      include: {
        project: { select: { gitlabId: true, name: true } },
      },
    });

    if (!workItem) return null;

    const base: FollowUpTicketContext = {
      followUpId,
      workItemId: workItem.id,
      title: workItem.title,
      type: workItem.type,
      description: trimText(workItem.description),
      webUrl: workItem.webUrl,
      comments: [],
      commentsSource: "none",
    };

    const projectGitlabId = workItem.project.gitlabId;
    const gitlabIid = workItem.gitlabIid;

    if (!projectGitlabId || !gitlabIid) {
      return base;
    }

    const config = getGitLabConfig();
    if (!config) {
      base.commentsSource = "unavailable";
      return base;
    }

    try {
      const provider = createGitLabProvider(config);
      const rawNotes =
        workItem.type === "MERGE_REQUEST"
          ? await provider.listMergeRequestNotes(projectGitlabId, gitlabIid)
          : await provider.listIssueNotes(projectGitlabId, gitlabIid);

      const comments = rawNotes
        .filter((note) => !note.system && note.body?.trim())
        .slice(-MAX_COMMENTS)
        .map((note) => ({
          id: note.id,
          authorName: note.author.name,
          authorUsername: note.author.username,
          body: trimText(note.body, 1500) ?? "",
          createdAt: note.created_at,
        }));

      return {
        ...base,
        comments,
        commentsSource: "gitlab",
      };
    } catch (error) {
      logger.warn("Failed to fetch GitLab notes for follow-up", {
        followUpId,
        workItemId: workItem.id,
        error,
      });
      return {
        ...base,
        commentsSource: "unavailable",
      };
    }
  }
}

export const followUpTicketService = new FollowUpTicketService();

export function formatTicketContextForAssistant(
  ticket: FollowUpTicketContext,
): string {
  const descriptionSection = ticket.description
    ? ticket.description
    : "No description stored in EMOS.";

  const commentsSection =
    ticket.comments.length > 0
      ? ticket.comments
          .map(
            (comment) =>
              `- ${comment.authorName} (@${comment.authorUsername}) · ${comment.createdAt}:\n  ${comment.body.replace(/\n/g, "\n  ")}`,
          )
          .join("\n")
      : ticket.commentsSource === "unavailable"
        ? "GitLab comments could not be loaded (check API token or project access)."
        : "No user comments on this ticket yet.";

  return `
### GitLab ticket thread (live)

Title: ${ticket.title}
Type: ${ticket.type}
URL: ${ticket.webUrl ?? "—"}

Description:
${descriptionSection}

Recent comments (${ticket.comments.length}):
${commentsSection}
`.trim();
}
