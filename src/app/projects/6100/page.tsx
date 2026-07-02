import { AppShell } from "@/components/layout/app-shell";
import { Project6100HygieneView } from "@/features/projects/components/project-6100-hygiene-view";

export default async function Project6100Page() {
  return (
    <AppShell>
      <Project6100HygieneView />
    </AppShell>
  );
}
