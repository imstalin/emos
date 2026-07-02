import { AppShell } from "@/components/layout/app-shell";
import { LinkedInPmView } from "@/features/linkedin/components/linkedin-pm-view";
import { getAssistantStatus } from "@/lib/openai-config";

export default async function LinkedInPmPage() {
  const status = getAssistantStatus();

  return (
    <AppShell>
      <LinkedInPmView status={status} />
    </AppShell>
  );
}
