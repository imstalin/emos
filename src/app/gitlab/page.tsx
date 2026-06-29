import { AppShell } from "@/components/layout/app-shell";
import { GitLabActivityView } from "@/features/gitlab/components/gitlab-activity-view";
import { gitlabSyncService } from "@/server/services/gitlab/gitlab-sync.service";

export default async function GitLabPage() {
  const status = gitlabSyncService
    ? await gitlabSyncService.getStatus()
    : null;

  return (
    <AppShell>
      <GitLabActivityView initialStatus={status} />
    </AppShell>
  );
}
