import { AppShell } from "@/components/layout/app-shell";
import { TeamDashboardView } from "@/features/team/components/team-dashboard-view";
import { teamDashboardService } from "@/server/services/team/team-dashboard.service";

export default async function TeamDashboardPage() {
  const data = await teamDashboardService.getDashboard();

  return (
    <AppShell>
      <TeamDashboardView data={data} />
    </AppShell>
  );
}
