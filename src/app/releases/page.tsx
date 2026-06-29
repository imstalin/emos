import { AppShell } from "@/components/layout/app-shell";
import { ReleasesView } from "@/features/releases/components/releases-view";
import { releasesService } from "@/server/services/releases/releases.service";

export default async function ReleasesPage() {
  const data = await releasesService.getDashboard();

  return (
    <AppShell>
      <ReleasesView data={data} />
    </AppShell>
  );
}
