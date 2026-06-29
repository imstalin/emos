import { z } from "zod";

const gitlabConfigSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
  groupId: z.string().min(1),
});

export type GitLabConfig = {
  url: string;
  token: string;
  groupId: string;
  baseUrl: string;
  webhookSecret: string | null;
  monitoredProjectIds: number[] | null;
};

function parseMonitoredProjectIds(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null;

  const ids = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  return ids.length > 0 ? ids : null;
}

export function getMonitoredGitLabProjectIds(): number[] | null {
  return parseMonitoredProjectIds(process.env.GITLAB_PROJECT_IDS);
}

export function isMonitoredGitLabProject(gitlabProjectId: number): boolean {
  const ids = getMonitoredGitLabProjectIds();
  if (!ids) return true;
  return ids.includes(gitlabProjectId);
}

export function getGitLabConfig(): GitLabConfig | null {
  const parsed = gitlabConfigSchema.safeParse({
    url: process.env.GITLAB_URL,
    token: process.env.GITLAB_TOKEN,
    groupId: process.env.GITLAB_GROUP_ID,
  });

  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    baseUrl: parsed.data.url.replace(/\/$/, ""),
    webhookSecret: process.env.GITLAB_WEBHOOK_SECRET?.trim() || null,
    monitoredProjectIds: getMonitoredGitLabProjectIds(),
  };
}

export function getWebhookUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) return null;
  return `${appUrl}/api/gitlab/webhook`;
}

export function getPublicGitLabConfig(): Pick<
  GitLabConfig,
  "url" | "groupId"
> | null {
  const config = getGitLabConfig();
  if (!config) return null;
  return { url: config.url, groupId: config.groupId };
}
