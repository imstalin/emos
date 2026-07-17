import { describe, expect, it, vi } from "vitest";

import type { GitLabConfig } from "@/lib/gitlab-config";

import { GitLabApiProvider } from "./gitlab-api.provider";

const config: GitLabConfig = {
  url: "https://gitlab.example",
  token: "test-token",
  groupId: "42",
  baseUrl: "https://gitlab.example",
  webhookSecret: null,
  monitoredProjectIds: null,
};

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function createProvider(fetchImpl: typeof fetch) {
  return new GitLabApiProvider(config, {
    fetchImpl,
    retryCount: 0,
    requestTimeoutMs: 5_000,
  });
}

describe("GitLabApiProvider sprint intelligence APIs", () => {
  it("0. lists project issues by milestone title only (not numeric milestone_id)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([], {
        headers: { "x-total-pages": "1", "x-next-page": "" },
      }),
    );
    const provider = createProvider(fetchImpl as unknown as typeof fetch);

    await provider.listProjectIssues(6100, "all", {
      milestone: "Jul - Sprint 1",
    });

    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.searchParams.get("milestone")).toBe("Jul - Sprint 1");
    expect(url.searchParams.has("milestone_id")).toBe(false);
  });

  it("0b. lists project issues with timebox milestone_id without title", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([], {
        headers: { "x-total-pages": "1", "x-next-page": "" },
      }),
    );
    const provider = createProvider(fetchImpl as unknown as typeof fetch);

    await provider.listProjectIssues(6100, "opened", {
      milestoneTimebox: "Any",
    });

    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.searchParams.get("milestone_id")).toBe("Any");
    expect(url.searchParams.has("milestone")).toBe(false);
  });

  it("1. lists resource milestone events with URL-encoded project path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        [
          {
            id: 1,
            action: "add",
            created_at: "2026-07-05T10:00:00.000Z",
            milestone: { id: 100, title: "Sprint 42" },
          },
        ],
        { headers: { "x-total-pages": "1", "x-next-page": "" } },
      ),
    );

    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const events = await provider.listIssueResourceMilestoneEvents(
      "group/project",
      15,
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("add");
    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toContain(
      "/projects/group%2Fproject/issues/15/resource_milestone_events",
    );
  });

  it("2. paginates resource milestone events via x-next-page", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ id: 1, action: "add", created_at: "a", milestone: null }], {
          headers: { "x-next-page": "2", "x-total-pages": "2" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          [{ id: 2, action: "remove", created_at: "b", milestone: null }],
          { headers: { "x-next-page": "", "x-total-pages": "2" } },
        ),
      );

    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const events = await provider.listIssueResourceMilestoneEvents(6100, 1);
    expect(events.map((event) => event.id)).toEqual([1, 2]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("22. stops pagination at maxPages", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          action: "add",
          created_at: "2026-07-05T00:00:00.000Z",
          milestone: { id: 1, title: "S" },
        })),
        { headers: { "x-next-page": "2", "x-total-pages": "5" } },
      ),
    );

    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const events = await provider.listIssueResourceMilestoneEvents(1, 1, {
      maxPages: 1,
    });
    expect(events).toHaveLength(100);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("6/7. lists and creates project labels", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ id: 1, name: "sprint::planned", color: "#428BCA", description: null }], {
          headers: { "x-total-pages": "1" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 2,
          name: "unplanned",
          color: "#A56CC1",
          description: "x",
        }),
      );

    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const listed = await provider.listProjectLabels(6100);
    expect(listed[0]?.name).toBe("sprint::planned");

    const created = await provider.createProjectLabel(6100, {
      name: "unplanned",
      color: "#A56CC1",
      description: "x",
    });
    expect(created.name).toBe("unplanned");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("/projects/6100/labels");
  });

  it("8. ensure labels when all exist", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        [
          { id: 1, name: "sprint::planned", color: "#428BCA", description: null },
          { id: 2, name: "unplanned", color: "#A56CC1", description: null },
        ],
        { headers: { "x-total-pages": "1" } },
      ),
    );
    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.ensureProjectLabels(1, [
      { name: "sprint::planned", color: "#428BCA" },
      { name: "unplanned", color: "#A56CC1" },
    ]);
    expect(result.existing).toEqual(["sprint::planned", "unplanned"]);
    expect(result.created).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("9/10. ensure labels reports missing and skips create when disabled", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([], { headers: { "x-total-pages": "1" } }),
    );
    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.ensureProjectLabels(
      1,
      [{ name: "sprint::planned", color: "#428BCA" }],
      { createMissingLabels: false },
    );
    expect(result.missing).toEqual(["sprint::planned"]);
    expect(result.created).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("9. ensure labels creates missing when enabled", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([], { headers: { "x-total-pages": "1" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 9,
          name: "sprint::planned",
          color: "#428BCA",
          description: "d",
        }),
      );

    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.ensureProjectLabels(1, [
      { name: "sprint::planned", color: "#428BCA", description: "d" },
    ]);
    expect(result.created).toEqual(["sprint::planned"]);
  });

  it("11. treats concurrent create conflict as success after verify", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([], { headers: { "x-total-pages": "1" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Label already exists" }), {
          status: 409,
          statusText: "Conflict",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          [{ id: 1, name: "unplanned", color: "#A56CC1", description: null }],
          { headers: { "x-total-pages": "1" } },
        ),
      );

    const provider = createProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.ensureProjectLabels(1, [
      { name: "unplanned", color: "#A56CC1" },
    ]);
    expect(result.created).toEqual(["unplanned"]);
    expect(result.failed).toEqual([]);
  });

  it("12/13/14. additive label update, removal, and no-op", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 1,
        iid: 10,
        project_id: 1,
        title: "t",
        labels: ["Type::Defect", "sprint::planned"],
        state: "opened",
      }),
    );
    const provider = createProvider(fetchImpl as unknown as typeof fetch);

    const updated = await provider.updateIssueLabels(1, 10, {
      labelsToAdd: ["sprint::committed"],
      labelsToRemove: ["sprint::spillover"],
    });
    expect(updated).not.toBeNull();
    const body = String(fetchImpl.mock.calls[0]?.[1]?.body);
    expect(body).toContain("add_labels=");
    expect(body).toContain("remove_labels=");
    expect(body.includes("&labels=") || body.startsWith("labels=")).toBe(false);

    const noop = await provider.updateIssueLabels(1, 10, {
      labelsToAdd: [],
      labelsToRemove: [],
    });
    expect(noop).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
