import { AppShell } from "@/components/layout/app-shell";
import { PlanningView } from "@/features/planning/components/planning-view";
import { planningService } from "@/server/services/planning/planning.service";

export default async function PlanningPage() {
  const document = await planningService.getDocument();
  const summary = planningService.buildSummary(document);

  return (
    <AppShell>
      <PlanningView initialDocument={document} initialSummary={summary} />
    </AppShell>
  );
}
