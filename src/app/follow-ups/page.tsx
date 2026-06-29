import { AppShell } from "@/components/layout/app-shell";
import { FollowUpsView } from "@/features/follow-ups/components/follow-ups-view";
import { followUpsService } from "@/server/services/follow-ups/follow-ups.service";

export default async function FollowUpsPage() {
  const data = await followUpsService.getDashboard();

  return (
    <AppShell>
      <FollowUpsView data={data} />
    </AppShell>
  );
}
