import { z } from "zod";

import {
  DEFAULT_MANAGER_PROGRESS_CONFIG,
  type ManagerProgressConfigData,
} from "@/domain/types/manager-progress";

const lifecycleStageSchema = z.object({
  slug: z.string(),
  name: z.string(),
  order: z.number(),
});

const thresholdsSchema = z.object({
  highPriorityStagnationDays: z.number().min(1),
  mrReviewWaitingDays: z.number().min(1),
  qaReadyWaitingDays: z.number().min(1),
  releaseProximityDays: z.number().min(1),
  maxActiveWip: z.number().min(1),
  feedStaleMinutes: z.number().min(5),
});

const configSchema = z.object({
  lifecycleStages: z.array(lifecycleStageSchema),
  thresholds: thresholdsSchema,
  holidays: z.array(z.string()),
  timezone: z.string(),
});

export function getManagerProgressFeedIntervalMinutes(): number {
  const value = Number(process.env.MANAGER_PROGRESS_FEED_INTERVAL_MINUTES ?? 12);
  if (!Number.isFinite(value) || value < 5) return 12;
  return Math.floor(value);
}

export function isManagerProgressEnabled(): boolean {
  return process.env.MANAGER_PROGRESS_ENABLED !== "false";
}

export function resolveFeedUrlFromEnv(feedEnvKey: string): string | null {
  const url = process.env[feedEnvKey]?.trim();
  if (!url) return null;
  return url;
}

export function parseManagerProgressConfig(
  raw: unknown,
): ManagerProgressConfigData {
  const parsed = configSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return DEFAULT_MANAGER_PROGRESS_CONFIG;
}

export function getConfiguredFeedEnvKeys(): string[] {
  return Object.keys(process.env).filter((key) =>
    key.startsWith("GITLAB_FEED_"),
  );
}

export const MANAGER_PROGRESS_QUEUE_NAME = "manager-progress-feed";
export const MANAGER_PROGRESS_JOB_NAME = "ingest-feeds";
export const MANAGER_PROGRESS_SCHEDULER_ID = "manager-progress-feed-scheduler";

export type ManagerProgressJobData = {
  trigger: "scheduled" | "manual";
  memberId?: string;
};

export type FeedMemberSeed = {
  name: string;
  gitlabUsername: string;
  role: "DEVELOPER" | "QA";
  teamSlug: "phoenix-core" | "phoenix-qa";
  feedEnvKey: string;
};

export const PHOENIX_FEED_MEMBERS: FeedMemberSeed[] = [
  {
    name: "Jayapal Muruganandham",
    gitlabUsername: "JayapalMuruganandham",
    role: "DEVELOPER",
    teamSlug: "phoenix-core",
    feedEnvKey: "GITLAB_FEED_JAYAPAL_MURUGANANDHAM",
  },
  {
    name: "Kumar Saravana",
    gitlabUsername: "KumarSaravana",
    role: "DEVELOPER",
    teamSlug: "phoenix-core",
    feedEnvKey: "GITLAB_FEED_KUMAR_SARAVANA",
  },
  {
    name: "Duraisamy Manikandaprabu",
    gitlabUsername: "DuraisamyManikandaprabu",
    role: "DEVELOPER",
    teamSlug: "phoenix-core",
    feedEnvKey: "GITLAB_FEED_DURAISAMY_MANIKANDAPRABU",
  },
  {
    name: "Raj Gowtham",
    gitlabUsername: "RajGowtham",
    role: "DEVELOPER",
    teamSlug: "phoenix-core",
    feedEnvKey: "GITLAB_FEED_RAJ_GOWTHAM",
  },
  {
    name: "Sankarasubbu Ramanathan",
    gitlabUsername: "SankarasubbuRamanathan",
    role: "DEVELOPER",
    teamSlug: "phoenix-core",
    feedEnvKey: "GITLAB_FEED_SANKARASUBBU_RAMANATHAN",
  },
  {
    name: "Subburajan Jawahar",
    gitlabUsername: "SubburajanJawahar",
    role: "DEVELOPER",
    teamSlug: "phoenix-core",
    feedEnvKey: "GITLAB_FEED_SUBBURAJAN_JAWAHAR",
  },
  {
    name: "Veluru Preethi",
    gitlabUsername: "VeluruPreethi",
    role: "QA",
    teamSlug: "phoenix-qa",
    feedEnvKey: "GITLAB_FEED_VELURU_PREETHI",
  },
  {
    name: "Subramanian Ruthrakkanth",
    gitlabUsername: "SubramanianRuthrakkanth",
    role: "QA",
    teamSlug: "phoenix-qa",
    feedEnvKey: "GITLAB_FEED_SUBRAMANIAN_RUTHRAKKANTH",
  },
  {
    name: "Selvam Kadarkarai",
    gitlabUsername: "SelvamKadarkarai",
    role: "QA",
    teamSlug: "phoenix-qa",
    feedEnvKey: "GITLAB_FEED_SELVAM_KADARKARAI",
  },
];
