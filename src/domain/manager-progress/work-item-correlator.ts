import type { CorrelationConfidence } from "@prisma/client";

import type {
  CorrelationSignal,
  NormalizedFeedActivity,
} from "@/domain/types/manager-progress";

const TICKET_PATTERN = /\b([A-Z]{2,10}-\d+)\b/g;
const MR_REF = /!(\d+)/;
const ISSUE_REF = /#(\d+)/;

export function extractExternalReferences(text: string): string[] {
  const refs = new Set<string>();
  for (const match of text.matchAll(TICKET_PATTERN)) {
    refs.add(match[1].toUpperCase());
  }
  return [...refs];
}

export function deriveCorrelationKey(
  activity: NormalizedFeedActivity,
): CorrelationSignal {
  const combined = `${activity.title} ${activity.description ?? ""} ${activity.branch ?? ""}`;
  const ticketRefs = extractExternalReferences(combined);

  if (ticketRefs.length > 0) {
    const fromBranch = activity.branch
      ? extractExternalReferences(activity.branch)
      : [];
    let confidence: CorrelationConfidence = "MEDIUM";
    if (
      (activity.mrNumber != null || activity.issueNumber != null) &&
      ticketRefs.length > 0
    ) {
      confidence = "HIGH";
    } else if (fromBranch.length > 0) {
      confidence = "MEDIUM";
    }
    return {
      externalReference: ticketRefs[0],
      confidence,
      title: ticketRefs[0],
    };
  }

  if (activity.mrNumber != null) {
    return {
      externalReference: `MR-${activity.mrNumber}`,
      confidence: "HIGH",
      title: activity.title.replace(/\s+/g, " ").slice(0, 120),
    };
  }

  if (activity.issueNumber != null) {
    return {
      externalReference: `ISSUE-${activity.issueNumber}`,
      confidence: "HIGH",
      title: activity.title.replace(/\s+/g, " ").slice(0, 120),
    };
  }

  if (activity.branch) {
    const branchRefs = extractExternalReferences(activity.branch);
    if (branchRefs.length > 0) {
      return {
        externalReference: branchRefs[0],
        confidence: "MEDIUM",
        title: branchRefs[0],
      };
    }
  }

  const keywordMatch = combined.match(/\b(TSC|Rewards|Advanced Search|Mobile|Platform)\b/i);
  if (keywordMatch) {
    return {
      externalReference: null,
      confidence: "LOW",
      title: keywordMatch[0],
    };
  }

  return {
    externalReference: null,
    confidence: "LOW",
    title: activity.title.slice(0, 120),
  };
}

export function correlationKeyForGrouping(signal: CorrelationSignal): string {
  if (signal.externalReference) return signal.externalReference;
  return signal.title.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export function parseMrNumber(text: string): number | null {
  const match = text.match(MR_REF);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function parseIssueNumber(text: string): number | null {
  const match = text.match(ISSUE_REF);
  return match ? Number.parseInt(match[1], 10) : null;
}
