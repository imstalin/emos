import { AppShell } from "@/components/layout/app-shell";
import { GovernanceView } from "@/features/governance/components/governance-view";
import { governanceService } from "@/server/services/governance/governance.service";

export default async function GovernancePage() {
  const report = await governanceService.getReport();

  return (
    <AppShell>
      <GovernanceView report={report} />
    </AppShell>
  );
}
