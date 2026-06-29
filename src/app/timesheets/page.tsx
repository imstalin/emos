import { AppShell } from "@/components/layout/app-shell";
import { TimesheetsView } from "@/features/timesheets/components/timesheets-view";
import { timesheetsService } from "@/server/services/timesheets/timesheets.service";

interface TimesheetsPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function TimesheetsPage({
  searchParams,
}: TimesheetsPageProps) {
  const params = await searchParams;
  const parsed = Number(params.week ?? 0);
  const weekOffset = Number.isFinite(parsed)
    ? Math.min(0, Math.max(-12, Math.trunc(parsed)))
    : 0;

  const data = await timesheetsService.getReport(weekOffset);

  return (
    <AppShell>
      <TimesheetsView data={data} />
    </AppShell>
  );
}
