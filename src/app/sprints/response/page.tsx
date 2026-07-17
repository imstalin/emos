import { AppShell } from "@/components/layout/app-shell";
import { SprintResponseView } from "@/features/sprint-response/components/sprint-response-view";
import { getGitLabConfig } from "@/lib/gitlab-config";

export default function SprintResponsePage() {
  const configured = Boolean(getGitLabConfig());

  return (
    <AppShell>
      <SprintResponseView configured={configured} />
    </AppShell>
  );
}
