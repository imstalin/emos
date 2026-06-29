import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { dashboardService } from "@/server/services/dashboard/dashboard.service";

export default async function DashboardPage() {
  const metrics = await dashboardService.getMetrics();

  return (
    <AppShell>
      <DashboardView metrics={metrics} />
    </AppShell>
  );
}
