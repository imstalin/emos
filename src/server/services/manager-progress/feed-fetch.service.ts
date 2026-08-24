import { redactFeedUrl } from "@/domain/manager-progress/atom-parser";
import { resolveFeedUrlFromEnv } from "@/lib/manager-progress-config";
import { logger } from "@/lib/logger";

const FEED_FETCH_TIMEOUT_MS = 30_000;

export interface FeedFetchResult {
  ok: boolean;
  status: number;
  body: string | null;
  error: string | null;
}

export async function fetchGitLabAtomFeed(
  feedEnvKey: string,
): Promise<FeedFetchResult> {
  const feedUrl = resolveFeedUrlFromEnv(feedEnvKey);
  if (!feedUrl) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: `Feed URL not configured for ${feedEnvKey}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/atom+xml, application/xml, text/xml",
        "User-Agent": "EMOS-Manager-Progress/1.0",
      },
    });

    if (!response.ok) {
      logger.warn("GitLab feed fetch failed", {
        feedEnvKey,
        feedPath: redactFeedUrl(feedUrl),
        status: response.status,
      });
      return {
        ok: false,
        status: response.status,
        body: null,
        error: `HTTP ${response.status}`,
      };
    }

    const body = await response.text();
    return { ok: true, status: response.status, body, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown feed fetch error";
    logger.warn("GitLab feed fetch error", {
      feedEnvKey,
      feedPath: redactFeedUrl(feedUrl),
      error: message,
    });
    return { ok: false, status: 0, body: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
