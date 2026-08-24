import type { BlockerCategory } from "@prisma/client";

import type { NormalizedFeedActivity } from "@/domain/types/manager-progress";

export interface DetectedBlocker {
  category: BlockerCategory;
  description: string;
  isConfirmed: boolean;
}

const BLOCKER_PATTERNS: Array<{
  pattern: RegExp;
  category: BlockerCategory;
  confirmed: boolean;
}> = [
  {
    pattern: /\bblocked\b|\bblocker\b|\bcannot proceed\b|\bunable to proceed\b/i,
    category: "UNKNOWN",
    confirmed: true,
  },
  {
    pattern: /\bwaiting for review\b|\bawaiting review\b|\bpending review\b/i,
    category: "REVIEW",
    confirmed: false,
  },
  {
    pattern: /\bwaiting for qa\b|\bqa pending\b|\bnot entered qa\b/i,
    category: "QA",
    confirmed: false,
  },
  {
    pattern: /\btenant unavailable\b|\benvironment unavailable\b|\bpprd\b.*\bunavailable\b/i,
    category: "ENVIRONMENT",
    confirmed: false,
  },
  {
    pattern: /\bpipeline failed\b|\bci failed\b|\bbuild failed\b/i,
    category: "INFRASTRUCTURE",
    confirmed: true,
  },
  {
    pattern: /\bdeployment failed\b|\bdeploy failed\b/i,
    category: "INFRASTRUCTURE",
    confirmed: true,
  },
  {
    pattern: /\bproduct decision\b|\bwaiting on product\b|\bneeds product\b/i,
    category: "PRODUCT_DECISION",
    confirmed: false,
  },
  {
    pattern: /\bexternal team\b|\bcross-team\b|\bdependency\b/i,
    category: "EXTERNAL_TEAM",
    confirmed: false,
  },
  {
    pattern: /\brelease dependency\b|\bblocked by release\b/i,
    category: "RELEASE",
    confirmed: false,
  },
];

export function detectBlockersFromActivity(
  activity: NormalizedFeedActivity,
): DetectedBlocker[] {
  const text = `${activity.title} ${activity.description ?? ""}`;
  const results: DetectedBlocker[] = [];

  for (const { pattern, category, confirmed } of BLOCKER_PATTERNS) {
    if (pattern.test(text)) {
      results.push({
        category,
        description: confirmed
          ? text.slice(0, 300)
          : `Possible blocker: ${text.slice(0, 250)}`,
        isConfirmed: confirmed,
      });
    }
  }

  if (activity.eventType === "pipeline" && /fail/i.test(text)) {
    results.push({
      category: "INFRASTRUCTURE",
      description: text.slice(0, 300),
      isConfirmed: true,
    });
  }

  return results;
}

export function detectReviewWaitingBlocker(
  stage: string,
  lastMeaningfulProgressAt: Date | null,
  waitingDays: number,
  workingDaysSince: (from: Date, to: Date) => number,
): DetectedBlocker | null {
  if (stage !== "code_review" || !lastMeaningfulProgressAt) return null;
  const days = workingDaysSince(lastMeaningfulProgressAt, new Date());
  if (days >= waitingDays) {
    return {
      category: "REVIEW",
      description: `Possible blocker: MR waiting for review for ${days} working day(s).`,
      isConfirmed: false,
    };
  }
  return null;
}

export function detectQaReadyBlocker(
  stage: string,
  lastMeaningfulProgressAt: Date | null,
  waitingDays: number,
  workingDaysSince: (from: Date, to: Date) => number,
): DetectedBlocker | null {
  if (stage !== "qa_ready" || !lastMeaningfulProgressAt) return null;
  const days = workingDaysSince(lastMeaningfulProgressAt, new Date());
  if (days >= waitingDays) {
    return {
      category: "QA",
      description: `Possible blocker: QA-ready item has not entered QA for ${days} working day(s).`,
      isConfirmed: false,
    };
  }
  return null;
}
