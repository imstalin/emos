import { AppShell } from "@/components/layout/app-shell";
import { AssistantView } from "@/features/assistant/components/assistant-view";
import { getAssistantStatus } from "@/lib/openai-config";

export default async function AssistantPage() {
  const status = getAssistantStatus();

  return (
    <AppShell>
      <AssistantView status={status} />
    </AppShell>
  );
}
