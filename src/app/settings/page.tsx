import { AppHeader } from "@/components/layout/app-header";
import { AppShell } from "@/components/layout/app-shell";
import { GitLabIntegrationPanel } from "@/features/settings/components/gitlab-integration-panel";

export default function SettingsPage() {
  return (
    <AppShell>
      <AppHeader
        title="Settings"
        description="Teams, projects, workflows, and integrations"
      />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <GitLabIntegrationPanel />
      </div>
    </AppShell>
  );
}
