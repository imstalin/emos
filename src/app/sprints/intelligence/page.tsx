import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { SprintIntelligenceView } from "@/features/sprint-intelligence/components/sprint-intelligence-view";

export default function SprintIntelligencePage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">
            Loading Sprint Intelligence…
          </div>
        }
      >
        <SprintIntelligenceView />
      </Suspense>
    </AppShell>
  );
}
