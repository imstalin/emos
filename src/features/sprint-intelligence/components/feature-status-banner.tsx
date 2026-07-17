"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SprintIntelligenceStatus } from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

export function FeatureStatusBanner({
  status,
}: {
  status: SprintIntelligenceStatus | undefined;
}) {
  if (!status) return null;

  const title = !status.enabled
    ? "Disabled"
    : status.dryRunOnly
      ? "Safe Mode"
      : "Apply Enabled";

  const description = !status.enabled
    ? "Sprint Intelligence is disabled. Enable SPRINT_INTELLIGENCE_ENABLED to use this feature."
    : status.dryRunOnly
      ? "Sprint Intelligence is enabled in dry-run-only mode. No GitLab labels will be changed."
      : "Manual apply is enabled. Every apply requires explicit confirmation.";

  const Icon = !status.enabled
    ? AlertCircle
    : status.dryRunOnly
      ? ShieldCheck
      : CheckCircle2;

  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <Icon
            className={
              !status.enabled
                ? "mt-0.5 size-5 text-amber-600"
                : status.dryRunOnly
                  ? "mt-0.5 size-5 text-sky-600"
                  : "mt-0.5 size-5 text-emerald-600"
            }
            aria-hidden
          />
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            {status.lastSuccessfulAnalysisAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Last successful analysis:{" "}
                {new Date(status.lastSuccessfulAnalysisAt).toLocaleString()}
                {status.lastSuccessfulAnalysisMilestone
                  ? ` · ${status.lastSuccessfulAnalysisMilestone}`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No successful analysis recorded yet.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Feature flags">
          <Badge variant="outline">
            Feature {status.enabled ? "on" : "off"}
          </Badge>
          <Badge variant="outline">
            Dry-run {status.dryRunOnly ? "only" : "off"}
          </Badge>
          <Badge variant="outline">
            Discovery {status.discoveryEnabled ? "on" : "off"}
          </Badge>
          <Badge variant="outline">
            Auto-apply {status.autoApply ? "on" : "off"}
          </Badge>
          <Badge variant="outline">
            Create labels {status.createMissingLabels ? "on" : "off"}
          </Badge>
          <Badge
            variant="outline"
            className={
              status.worker.redisAvailable
                ? undefined
                : "border-amber-300 text-amber-800"
            }
          >
            {status.worker.redisAvailable ? (
              <Info className="size-3" aria-hidden />
            ) : (
              <WifiOff className="size-3" aria-hidden />
            )}
            Worker {status.worker.redisAvailable ? "reachable" : "unavailable"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
