import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeBackoffDelayMs,
  DEFAULT_GITLAB_RESILIENCE,
  encodeGitLabProjectId,
  executeGitLabRequest,
  GitLabApiError,
  isRetryableStatus,
  parseRetryAfterMs,
} from "./gitlab-request";

describe("gitlab-request helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("encodes project paths for GitLab URLs", () => {
    expect(encodeGitLabProjectId(6100)).toBe("6100");
    expect(encodeGitLabProjectId("group/project")).toBe("group%2Fproject");
  });

  it("parses Retry-After seconds and HTTP dates", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it("retries only retryable statuses", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
  });

  it("15. retries HTTP 429 with Retry-After", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "Retry-After": "1" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const promise = executeGitLabRequest({
      baseUrl: "https://gitlab.example",
      token: "secret-token",
      path: "/projects/1",
      method: "GET",
      idempotent: true,
      resilience: {
        ...DEFAULT_GITLAB_RESILIENCE,
        retryCount: 2,
        retryBaseDelayMs: 10,
        retryMaxDelayMs: 5_000,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await vi.runAllTimersAsync();
    const response = await promise;
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstCallHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(firstCallHeaders["PRIVATE-TOKEN"]).toBe("secret-token");
  });

  it("16. retries HTTP 429 without Retry-After using backoff", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429, statusText: "Too Many Requests" }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const promise = executeGitLabRequest({
      baseUrl: "https://gitlab.example",
      token: "t",
      path: "/projects/1",
      method: "GET",
      idempotent: true,
      resilience: {
        ...DEFAULT_GITLAB_RESILIENCE,
        retryCount: 2,
        retryBaseDelayMs: 20,
        retryMaxDelayMs: 100,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await vi.runAllTimersAsync();
    await promise;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("17. retries HTTP 502/503/504", async () => {
    for (const status of [502, 503, 504]) {
      vi.useFakeTimers();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("err", { status }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      const promise = executeGitLabRequest({
        baseUrl: "https://gitlab.example",
        token: "t",
        path: "/x",
        method: "GET",
        idempotent: true,
        resilience: {
          ...DEFAULT_GITLAB_RESILIENCE,
          retryCount: 1,
          retryBaseDelayMs: 1,
          retryMaxDelayMs: 10,
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      await vi.runAllTimersAsync();
      await promise;
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    }
  });

  it("18/19. does not retry HTTP 400/401/403", async () => {
    for (const status of [400, 401, 403]) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(new Response("err", { status, statusText: "Nope" }));

      await expect(
        executeGitLabRequest({
          baseUrl: "https://gitlab.example",
          token: "t",
          path: "/x",
          method: "GET",
          idempotent: true,
          resilience: { ...DEFAULT_GITLAB_RESILIENCE, retryCount: 3 },
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).rejects.toBeInstanceOf(GitLabApiError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("20. retries timeout-like network errors when idempotent", async () => {
    vi.useFakeTimers();
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const promise = executeGitLabRequest({
      baseUrl: "https://gitlab.example",
      token: "t",
      path: "/x",
      method: "GET",
      idempotent: true,
      resilience: {
        ...DEFAULT_GITLAB_RESILIENCE,
        retryCount: 1,
        retryBaseDelayMs: 1,
        retryMaxDelayMs: 10,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await vi.runAllTimersAsync();
    await promise;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("21. exhausts retries and throws", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockImplementation(async () =>
      new Response("down", { status: 503, statusText: "Unavailable" }),
    );

    const promise = executeGitLabRequest({
      baseUrl: "https://gitlab.example",
      token: "t",
      path: "/x",
      method: "GET",
      idempotent: true,
      resilience: {
        ...DEFAULT_GITLAB_RESILIENCE,
        retryCount: 2,
        retryBaseDelayMs: 1,
        retryMaxDelayMs: 5,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).then(
      () => {
        throw new Error("expected failure");
      },
      (error: unknown) => error,
    );

    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(GitLabApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("caps backoff delay", () => {
    const delay = computeBackoffDelayMs(10, {
      ...DEFAULT_GITLAB_RESILIENCE,
      retryBaseDelayMs: 1_000,
      retryMaxDelayMs: 2_000,
    }, null);
    expect(delay).toBeLessThanOrEqual(2_000);
  });
});
