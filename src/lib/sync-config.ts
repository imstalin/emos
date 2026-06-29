export const GITLAB_SYNC_QUEUE_NAME = "gitlab-sync";
export const GITLAB_SYNC_JOB_NAME = "sync-all";
export const GITLAB_SYNC_SCHEDULER_ID = "gitlab-sync-scheduler";

export type GitLabSyncJobData = {
  trigger: "scheduled" | "manual" | "webhook";
  projectId?: number;
};

export function getSyncIntervalMinutes(): number {
  const value = Number(process.env.GITLAB_SYNC_INTERVAL_MINUTES ?? 15);
  if (!Number.isFinite(value) || value < 1) {
    return 15;
  }
  return Math.floor(value);
}
