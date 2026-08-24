import { XMLParser } from "fast-xml-parser";

import type { NormalizedFeedActivity } from "@/domain/types/manager-progress";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
});

type AtomEntry = {
  id?: string;
  title?: string | { "#text"?: string };
  updated?: string;
  published?: string;
  link?: AtomLink | AtomLink[];
  author?: { name?: string };
  content?: string | { "#text"?: string; "@_type"?: string };
  summary?: string | { "#text"?: string };
};

type AtomLink = {
  "@_href"?: string;
  "@_rel"?: string;
};

function textValue(value: string | { "#text"?: string } | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return (value["#text"] ?? "").trim();
}

function primaryLink(entry: AtomEntry): string | null {
  const links = entry.link;
  if (!links) return null;
  const list = Array.isArray(links) ? links : [links];
  const alternate =
    list.find((link) => link["@_rel"] === "alternate") ?? list[0];
  return alternate?.["@_href"] ?? null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyEventType(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (/\bmerged\b|\baccepted\b/.test(text) && /\bmerge request\b|\bmr\b|!/.test(text)) {
    return "merge_request_merged";
  }
  if (/\bapproved\b/.test(text) && /\bmerge request\b|\bmr\b|!/.test(text)) {
    return "merge_request_approved";
  }
  if (/\bclosed\b/.test(text) && /\bmerge request\b|\bmr\b|!/.test(text)) {
    return "merge_request_closed";
  }
  if (/\bopened\b/.test(text) && /\bmerge request\b|\bmr\b|!/.test(text)) {
    return "merge_request_opened";
  }
  if (/\bcommented\b/.test(text) && /\bmerge request\b|\bmr\b|!/.test(text)) {
    return "merge_request_commented";
  }
  if (/\bupdated\b/.test(text) && /\bmerge request\b|\bmr\b|!/.test(text)) {
    return "merge_request_updated";
  }
  if (/\bcommented\b/.test(text) && /\bissue\b|#/.test(text)) {
    return "issue_commented";
  }
  if (/\bclosed\b/.test(text) && /\bissue\b|#/.test(text)) {
    return "issue_closed";
  }
  if (/\bopened\b/.test(text) && /\bissue\b|#/.test(text)) {
    return "issue_opened";
  }
  if (/\bupdated\b/.test(text) && /\bissue\b|#/.test(text)) {
    return "issue_updated";
  }
  if (/\bpushed\b/.test(text) && /\bbranch\b/.test(text)) {
    return "push_to_branch";
  }
  if (/\bcreated\b/.test(text) && /\bbranch\b/.test(text)) {
    return "branch_created";
  }
  if (/\bdeleted\b/.test(text) && /\bbranch\b/.test(text)) {
    return "branch_deleted";
  }
  if (/\bcommit\b/.test(text)) {
    return "commit";
  }
  if (/\btag\b/.test(text)) {
    return "tag";
  }
  if (/\brelease\b/.test(text)) {
    return "release";
  }
  if (/\bpipeline\b/.test(text)) {
    return "pipeline";
  }
  if (/\bdeploy/.test(text)) {
    return "deployment";
  }

  return "other";
}

function extractMrNumber(text: string): number | null {
  const match = text.match(/!(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractIssueNumber(text: string): number | null {
  const match = text.match(/#(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractBranch(text: string): string | null {
  const match = text.match(/branch[:\s]+['"]?([^\s'"]+)['"]?/i);
  return match?.[1] ?? null;
}

function extractCommitSha(text: string): string | null {
  const match = text.match(/\b([0-9a-f]{7,40})\b/i);
  return match?.[1] ?? null;
}

function extractProject(title: string, url: string | null): string | null {
  if (url) {
    const match = url.match(/\/([^/]+\/[^/]+)\/-\//);
    if (match) return match[1];
  }
  const titleMatch = title.match(/in\s+([^\s]+(?:\/[^\s]+)?)/i);
  return titleMatch?.[1] ?? null;
}

function extractEnvironment(text: string): string | null {
  const match = text.match(/\b(PPRD|QA|UAT|PROD|PRODUCTION|STAGING|DEV)\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function normalizeAtomEntry(entry: AtomEntry): NormalizedFeedActivity | null {
  const gitlabEventId = entry.id?.trim();
  if (!gitlabEventId) return null;

  const title = textValue(entry.title);
  if (!title) return null;

  const rawContent =
    textValue(entry.content) || textValue(entry.summary) || title;
  const description = stripHtml(rawContent) || null;
  const url = primaryLink(entry);
  const timestampStr = entry.updated ?? entry.published;
  const timestamp = timestampStr ? new Date(timestampStr) : new Date();
  if (Number.isNaN(timestamp.getTime())) return null;

  const eventType = classifyEventType(title, description ?? "");
  const combined = `${title} ${description ?? ""}`;

  return {
    gitlabEventId,
    eventType,
    title,
    description,
    url,
    project: extractProject(title, url),
    repository: extractProject(title, url),
    branch: extractBranch(combined),
    commitSha: extractCommitSha(combined),
    mrNumber: extractMrNumber(combined),
    issueNumber: extractIssueNumber(combined),
    pipelineId: null,
    environment: extractEnvironment(combined),
    timestamp,
    rawPayload: entry as unknown as Record<string, unknown>,
  };
}

export function parseGitLabAtomFeed(xml: string): NormalizedFeedActivity[] {
  const parsed = parser.parse(xml) as { feed?: { entry?: AtomEntry | AtomEntry[] } };
  const entries = parsed.feed?.entry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];
  const results: NormalizedFeedActivity[] = [];

  for (const entry of list) {
    const normalized = normalizeAtomEntry(entry);
    if (normalized) results.push(normalized);
  }

  return results;
}

export function redactFeedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("feed_token");
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "[invalid-feed-url]";
  }
}
