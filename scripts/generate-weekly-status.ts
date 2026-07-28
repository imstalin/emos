/**
 * Generate a weekly status markdown draft from:
 *   config/weekly-status/workstreams.json
 * + latest Sprint Intelligence analysis (optional)
 *
 * Usage:
 *   npm run weekly-status
 *   npm run weekly-status -- --date 2026-07-25
 *   npm run weekly-status -- --out ./weekly-status-2026-07-25.md
 *   npm run weekly-status -- --config ./config/weekly-status/workstreams.json
 *
 * Workflow:
 *   1. Update workstream rows in config/weekly-status/workstreams.json during the week
 *   2. Run this command on Friday / Monday
 *   3. Review the generated markdown, edit confirms, then send
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { generateWeeklyStatusDraft } from "../src/server/services/weekly-status/weekly-status.service";

function parseArgs(argv: string[]) {
  const args = {
    date: null as string | null,
    out: null as string | null,
    config: null as string | null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--date" && next) {
      args.date = next;
      i += 1;
    } else if (token === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (token === "--config" && next) {
      args.config = next;
      i += 1;
    } else if (token === "--help" || token === "-h") {
      console.log(`Usage: npm run weekly-status -- [--date YYYY-MM-DD] [--out path] [--config path]`);
      process.exit(0);
    }
  }

  return args;
}

function parseWeekEndingDate(value: string | null): Date {
  if (!value) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid --date "${value}". Expected YYYY-MM-DD.`);
  }
  // Noon UTC keeps the calendar day stable across IST.
  return new Date(`${value}T12:00:00.000Z`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const weekEndingDate = parseWeekEndingDate(args.date);
  const draft = await generateWeeklyStatusDraft({
    weekEndingDate,
    configPath: args.config ?? undefined,
  });

  const outputPath = path.resolve(process.cwd(), args.out ?? draft.filename);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, draft.markdown, "utf8");

  console.log(`Weekly status draft written to ${outputPath}`);
  console.log(
    `Workstreams: ${draft.config.workstreams.length} · Sprint Intelligence: ${
      draft.config.includeSprintIntelligence ? "enabled" : "disabled"
    }`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
