import { logger } from "@/lib/logger";

export type GitLabHttpMethod = "GET" | "POST" | "PUT";

export interface GitLabResilienceConfig {
  requestTimeoutMs: number;
  retryCount: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
}

export const DEFAULT_GITLAB_RESILIENCE: GitLabResilienceConfig = {
  requestTimeoutMs: 25_000,
  retryCount: 3,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 10_000,
};

export class GitLabApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly retryAfterMs: number | null;

  constructor(params: {
    status: number;
    statusText: string;
    body: string;
    retryAfterMs?: number | null;
  }) {
    super(
      `GitLab API ${params.status} ${params.statusText}: ${params.body.slice(0, 200)}`,
    );
    this.name = "GitLabApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.body = params.body;
    this.retryAfterMs = params.retryAfterMs ?? null;
  }
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header?.trim()) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) {
    return asInt * 1000;
  }
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError" || error.name === "AbortError") return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("socket hang up")
  );
}

export function computeBackoffDelayMs(
  attempt: number,
  config: GitLabResilienceConfig,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs != null) {
    return Math.min(retryAfterMs, config.retryMaxDelayMs);
  }
  const exp = Math.min(
    config.retryMaxDelayMs,
    config.retryBaseDelayMs * 2 ** attempt,
  );
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
  return Math.min(config.retryMaxDelayMs, exp + jitter);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ExecuteGitLabRequestParams {
  baseUrl: string;
  token: string;
  path: string;
  method: GitLabHttpMethod;
  params?: Record<string, string>;
  body?: string | null;
  contentType?: string;
  /** GET and idempotent PUT/POST (label mutations) may retry. */
  idempotent: boolean;
  resilience: GitLabResilienceConfig;
  fetchImpl?: typeof fetch;
}

/**
 * Execute a GitLab API request with timeout, rate-limit awareness, and retries.
 * Never logs the access token.
 */
export async function executeGitLabRequest(
  params: ExecuteGitLabRequestParams,
): Promise<Response> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const url = new URL(`${params.baseUrl.replace(/\/$/, "")}/api/v4${params.path}`);
  for (const [key, value] of Object.entries(params.params ?? {})) {
    url.searchParams.set(key, value);
  }

  const maxAttempts = params.idempotent
    ? params.resilience.retryCount + 1
    : 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url.toString(), {
        method: params.method,
        headers: {
          "PRIVATE-TOKEN": params.token,
          Accept: "application/json",
          ...(params.contentType
            ? { "Content-Type": params.contentType }
            : {}),
        },
        body: params.body ?? undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(params.resilience.requestTimeoutMs),
      });

      if (response.ok || response.status === 204) {
        return response;
      }

      const body = await response.text();
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after"),
      );
      const error = new GitLabApiError({
        status: response.status,
        statusText: response.statusText,
        body,
        retryAfterMs,
      });

      const canRetry =
        params.idempotent &&
        attempt < maxAttempts - 1 &&
        isRetryableStatus(response.status);

      if (!canRetry) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(
        attempt,
        params.resilience,
        retryAfterMs,
      );
      logger.warn("sprint-intelligence.gitlab.retry", {
        path: params.path,
        method: params.method,
        status: response.status,
        attempt: attempt + 1,
        delayMs,
        rateLimited: response.status === 429,
      });
      if (response.status === 429) {
        logger.warn("sprint-intelligence.gitlab.rate-limited", {
          path: params.path,
          retryAfterMs,
          delayMs,
        });
      }
      await sleep(delayMs);
      lastError = error;
      continue;
    } catch (error) {
      if (error instanceof GitLabApiError) {
        throw error;
      }

      const canRetry =
        params.idempotent &&
        attempt < maxAttempts - 1 &&
        isRetryableNetworkError(error);

      if (!canRetry) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(attempt, params.resilience, null);
      logger.warn("sprint-intelligence.gitlab.retry", {
        path: params.path,
        method: params.method,
        attempt: attempt + 1,
        delayMs,
        error: error instanceof Error ? error.message : "unknown",
      });
      await sleep(delayMs);
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("GitLab request failed after retries");
}

export function encodeGitLabProjectId(projectId: string | number): string {
  return encodeURIComponent(String(projectId));
}

export function isLabelAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof GitLabApiError)) return false;
  if (error.status !== 409 && error.status !== 400) return false;
  const body = error.body.toLowerCase();
  return (
    body.includes("already exists") ||
    body.includes("has already been taken") ||
    body.includes("name has already been taken")
  );
}
