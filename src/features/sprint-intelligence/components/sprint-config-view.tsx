"use client";

import { useSprintIntelligenceConfig } from "@/features/sprint-intelligence/hooks/use-sprint-intelligence";

export function SprintConfigView({ enabled }: { enabled: boolean }) {
  const config = useSprintIntelligenceConfig(enabled);

  if (config.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading configuration…</p>;
  }

  if (config.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {(config.error as Error).message}
      </p>
    );
  }

  const values = config.data?.values ?? {};

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Read-only effective configuration. Secrets such as GitLab tokens and Redis
        credentials are never exposed.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Sprint intelligence configuration</caption>
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Setting</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(values).map(([key, item]) => (
              <tr key={key} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{key}</td>
                <td className="px-3 py-2">{String(item.value)}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {(config.data?.notes ?? []).map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
