import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type {
  WeeklySprintIntelligenceSnapshot,
  WeeklyStatusConfig,
  WeeklyStatusDraftInput,
} from "@/domain/types/weekly-status";
import { db } from "@/lib/db";

const workstreamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().min(1),
  status: z.string().min(1),
  completedThisWeek: z.string(),
  currentProgress: z.string(),
  risks: z.string(),
  targetDate: z.string(),
  nextMilestone: z.string(),
  remarks: z.string(),
});

const configSchema = z.object({
  recipientName: z.string().min(1),
  senderName: z.string().min(1),
  timezone: z.string().min(1),
  intro: z.string().min(1),
  overallSummary: z.string().min(1),
  includeSprintIntelligence: z.boolean().default(true),
  additionalItems: z.array(z.string()),
  asks: z.array(z.string()),
  workstreams: z.array(workstreamSchema).min(1),
});

export const DEFAULT_WEEKLY_STATUS_CONFIG_PATH = path.join(
  process.cwd(),
  "config/weekly-status/workstreams.json",
);

export function loadWeeklyStatusConfig(
  configPath: string = DEFAULT_WEEKLY_STATUS_CONFIG_PATH,
): WeeklyStatusConfig {
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  return configSchema.parse(raw);
}

export function formatWeekEndingLabel(
  date: Date,
  timeZone = "Asia/Kolkata",
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  return `${day}/${month}/${year}`;
}

export function weeklyStatusOutputFilename(
  date: Date,
  timeZone = "Asia/Kolkata",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `weekly-status-${year}-${month}-${day}.md`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `~${Math.round(value)}%`;
}

function buildSprintReadout(snapshot: {
  commitmentReliabilityPercent: number | null;
  spilloverPercent: number | null;
  unplannedWorkPercent: number | null;
  milestoneTitle: string;
}): string {
  const reliability = snapshot.commitmentReliabilityPercent;
  const spillover = snapshot.spilloverPercent;
  const unplanned = snapshot.unplannedWorkPercent;

  if (
    (reliability != null && reliability < 50) ||
    (spillover != null && spillover >= 50) ||
    (unplanned != null && unplanned >= 25)
  ) {
    return `${snapshot.milestoneTitle} shows elevated spillover and/or unplanned work with commitment reliability at ${formatPercent(reliability)}. Recommend a short delivery huddle on spillover drivers and whether support/migration load is displacing planned commitment.`;
  }

  return `${snapshot.milestoneTitle} delivery metrics look comparatively stable. Continue tracking spillover and unplanned intake through the sprint.`;
}

export async function loadLatestSprintIntelligenceSnapshot(): Promise<WeeklySprintIntelligenceSnapshot | null> {
  const run = await db.sprintEvaluationRun.findFirst({
    where: {
      mode: "ANALYZE",
      status: { in: ["COMPLETED", "PARTIAL"] },
    },
    orderBy: { completedAt: "desc" },
  });
  if (!run) return null;

  const metrics = (run.metrics ?? {}) as Record<string, unknown>;
  const summary = (run.summary ?? {}) as Record<string, unknown>;
  const num = (...keys: string[]) => {
    for (const key of keys) {
      const value = metrics[key] ?? summary[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
  };
  const nullableNum = (key: string) => {
    const value = metrics[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const snapshotBase = {
    milestoneTitle: run.milestoneTitle,
    commitmentReliabilityPercent: nullableNum("commitmentReliabilityPercent"),
    spilloverPercent: nullableNum("spilloverPercent"),
    unplannedWorkPercent: nullableNum("unplannedWorkPercent"),
  };

  return {
    milestoneTitle: run.milestoneTitle,
    completedAt: run.completedAt?.toISOString() ?? null,
    issuesEvaluated: num("issuesEvaluated"),
    plannedCount: num("plannedCount"),
    committedCount: num("committedCount"),
    spilloverCount: num("spilloverCount"),
    spilloverPercent: snapshotBase.spilloverPercent,
    unplannedCount: num("unplannedCount"),
    unplannedWorkPercent: snapshotBase.unplannedWorkPercent,
    completedUnplannedCount: num("completedUnplannedCount"),
    commitmentReliabilityPercent: snapshotBase.commitmentReliabilityPercent,
    bugCount: num("bugCount"),
    readout: buildSprintReadout(snapshotBase),
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderWeeklyStatusMarkdown(input: WeeklyStatusDraftInput): string {
  const { config, weekEndingDate, sprintIntelligence } = input;
  const weekLabel = formatWeekEndingLabel(weekEndingDate, config.timezone);

  const header = [
    "Workstream",
    "Team/Owner",
    "Status",
    `Completed This Week (${weekLabel})`,
    "Current Progress",
    "Risks / Dependencies",
    "Target Date",
    "Next Milestone",
    "Remarks",
  ];

  const rows = config.workstreams.map((item) =>
    [
      item.name,
      item.owner,
      item.status,
      item.completedThisWeek || "—",
      item.currentProgress || "—",
      item.risks || "—",
      item.targetDate || "—",
      item.nextMilestone || "—",
      item.remarks || "—",
    ]
      .map(escapeCell)
      .join(" | "),
  );

  const table = [
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");

  const additional =
    config.additionalItems.length > 0
      ? [
          "### Additional items",
          ...config.additionalItems.map((item, index) => `${index + 1}. ${item}`),
          "",
        ].join("\n")
      : "";

  const asks =
    config.asks.length > 0
      ? [
          "### Ask / decisions needed",
          ...config.asks.map((item, index) => `${index + 1}. ${item}`),
          "",
        ].join("\n")
      : "";

  let sprintSection = "";
  if (config.includeSprintIntelligence) {
    if (sprintIntelligence) {
      const completedLabel = sprintIntelligence.completedAt
        ? formatWeekEndingLabel(
            new Date(sprintIntelligence.completedAt),
            config.timezone,
          )
        : weekLabel;
      sprintSection = [
        `### Engineering delivery snapshot (${sprintIntelligence.milestoneTitle})`,
        `*Source: Sprint Intelligence analysis (completed ${completedLabel}) — for internal engineering visibility*`,
        "",
        "| Metric | Value |",
        "|---|---|",
        `| Issues evaluated | ${sprintIntelligence.issuesEvaluated} |`,
        `| Planned | ${sprintIntelligence.plannedCount} |`,
        `| Committed (completed planned) | ${sprintIntelligence.committedCount} |`,
        `| Spillover | ${sprintIntelligence.spilloverCount} (${formatPercent(sprintIntelligence.spilloverPercent)}) |`,
        `| Unplanned | ${sprintIntelligence.unplannedCount} (${formatPercent(sprintIntelligence.unplannedWorkPercent)}) |`,
        `| Completed unplanned | ${sprintIntelligence.completedUnplannedCount} |`,
        `| Commitment reliability | ${formatPercent(sprintIntelligence.commitmentReliabilityPercent)} |`,
        `| Bugs (work type) | ${sprintIntelligence.bugCount} |`,
        "",
        `**Readout:** ${sprintIntelligence.readout}`,
        "",
        "---",
        "",
      ].join("\n");
    } else {
      sprintSection = [
        "### Engineering delivery snapshot",
        "*Sprint Intelligence snapshot unavailable — run an analysis or check database connectivity.*",
        "",
        "---",
        "",
      ].join("\n");
    }
  }

  return [
    `Hi ${config.recipientName},`,
    "",
    config.intro,
    "",
    config.overallSummary,
    "",
    "Please find the detailed status in the table below.",
    "",
    table,
    "",
    additional,
    "---",
    "",
    sprintSection,
    asks,
    "Regards,",
    config.senderName,
    "",
  ]
    .filter((block, index, arr) => !(block === "" && arr[index - 1] === ""))
    .join("\n");
}

export async function generateWeeklyStatusDraft(options?: {
  configPath?: string;
  weekEndingDate?: Date;
}): Promise<{ markdown: string; filename: string; config: WeeklyStatusConfig }> {
  const config = loadWeeklyStatusConfig(options?.configPath);
  const weekEndingDate = options?.weekEndingDate ?? new Date();
  const sprintIntelligence = config.includeSprintIntelligence
    ? await loadLatestSprintIntelligenceSnapshot()
    : null;

  const markdown = renderWeeklyStatusMarkdown({
    config,
    weekEndingDate,
    sprintIntelligence,
  });

  return {
    markdown,
    filename: weeklyStatusOutputFilename(weekEndingDate, config.timezone),
    config,
  };
}
