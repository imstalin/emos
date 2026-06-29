import { AppShell } from "@/components/layout/app-shell";
import { Connect3030View } from "@/features/connect-3030/components/connect3030-view";
import { connect3030Service } from "@/server/services/connect-3030/connect3030.service";

export default async function Connect3030Page() {
  const data = await connect3030Service.getDashboard();

  return (
    <AppShell>
      <Connect3030View initialData={data} />
    </AppShell>
  );
}
