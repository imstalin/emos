import { AppShell } from "@/components/layout/app-shell";
import { CommentsMonitorView } from "@/features/gitlab-comments/components/comments-monitor-view";
import { getGitLabConfig } from "@/lib/gitlab-config";

export default function GitLabCommentsMonitorPage() {
  const configured = Boolean(getGitLabConfig());

  return (
    <AppShell>
      <CommentsMonitorView configured={configured} />
    </AppShell>
  );
}
