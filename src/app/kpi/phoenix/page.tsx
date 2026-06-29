import { AppShell } from "@/components/layout/app-shell";
import { PhoenixKpiView } from "@/features/kpi/components/phoenix-kpi-view";
import { phoenixKpiService } from "@/server/services/kpi/phoenix-kpi.service";

export default async function PhoenixKpiPage() {
  const data = await phoenixKpiService.getData();
  const memberReport = await phoenixKpiService.getMemberReport();

  return (
    <AppShell>
      <PhoenixKpiView initialData={data} initialMemberReport={memberReport} />
    </AppShell>
  );
}
