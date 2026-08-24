import type {
  ManagerProgressDashboard,
  ManagerProgressFilters,
  WorkItemDetailView,
} from "@/domain/types/manager-progress";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function buildQuery(filters: ManagerProgressFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchManagerProgressDashboard(
  filters: ManagerProgressFilters = {},
): Promise<ManagerProgressDashboard> {
  return getJson(`/api/manager/progress${buildQuery(filters)}`);
}

export async function fetchWorkItemDetail(
  workItemId: string,
): Promise<WorkItemDetailView> {
  return getJson(`/api/work-items/${workItemId}`);
}

export async function applyWorkItemOverride(
  workItemId: string,
  input: { field: string; newValue: string; reason?: string },
): Promise<WorkItemDetailView> {
  const response = await fetch(`/api/work-items/${workItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to apply override");
  }
  return response.json() as Promise<WorkItemDetailView>;
}

export async function fetchFeedHealth() {
  return getJson<{
    health: Array<{
      memberName: string;
      status: string;
      feedEnabled: boolean;
      lastSuccessfulFetch: string | null;
      lastError: string | null;
    }>;
  }>("/api/gitlab/feed-health");
}

export async function triggerFeedIngestion() {
  const response = await fetch("/api/gitlab/feed-health", { method: "POST" });
  if (!response.ok) throw new Error("Failed to queue feed ingestion");
  return response.json() as Promise<{ queued: boolean; jobId?: string }>;
}

export async function fetchDsmView(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return getJson<{ rows: Array<Record<string, string | null>> }>(
    `/api/manager/progress/dsm${query}`,
  );
}
