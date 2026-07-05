import { AppShell } from "@/components/layout/app-shell";
import { SprintPlanningView } from "@/features/sprint-planning/components/sprint-planning-view";
import { sprintPlanningService } from "@/server/services/sprint/sprint-planning.service";

export default async function SprintPlanningPage() {
  const board = await sprintPlanningService.getBoard();

  return (
    <AppShell>
      <SprintPlanningView initialBoard={board} />
    </AppShell>
  );
}
