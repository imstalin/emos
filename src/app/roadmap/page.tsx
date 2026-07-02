import { AppShell } from "@/components/layout/app-shell";
import { RoadmapView } from "@/features/roadmap/components/roadmap-view";
import { roadmapService } from "@/server/services/roadmap/roadmap.service";

export default async function RoadmapMaintenancePage() {
  const data = await roadmapService.getData();

  return (
    <AppShell>
      <RoadmapView initialData={data} />
    </AppShell>
  );
}
