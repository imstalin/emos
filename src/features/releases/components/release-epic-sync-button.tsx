"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ReleaseEpicSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/releases/sync", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        epicsSynced?: number;
        issuesSynced?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Sync failed");
      }

      setMessage(
        `Synced ${payload.epicsSynced ?? 0} epics · ${payload.issuesSynced ?? 0} issues`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
        Sync release epics
      </Button>
    </div>
  );
}
