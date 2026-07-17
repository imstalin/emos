import type {
  ApiErrorBody,
  ConfigView,
  IssueFilters,
  Paginated,
  SprintIntelligenceMilestone,
  SprintIntelligenceStatus,
  SprintIssueListItem,
  SprintRunDetail,
  LabelActionItem,
} from "@/features/sprint-intelligence/types/sprint-intelligence-ui";

async function parseError(response: Response): Promise<Error> {
  const data = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const message =
    typeof data.error === "string"
      ? data.error
      : data.error?.message ?? `Request failed (${response.status})`;
  return new Error(message);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export async function fetchSprintIntelligenceStatus() {
  return getJson<SprintIntelligenceStatus>("/api/sprints/intelligence/status");
}

export async function fetchSprintMilestones() {
  return getJson<{
    milestones: SprintIntelligenceMilestone[];
    defaultProjectIds: number[];
  }>("/api/sprints/intelligence/milestones");
}

export async function fetchSprintRuns(params: {
  page?: number;
  pageSize?: number;
  mode?: string;
  status?: string;
  triggerType?: string;
  milestoneId?: number;
}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") search.set(key, String(value));
  });
  return getJson<Paginated<SprintRunDetail>>(
    `/api/sprints/intelligence/runs?${search.toString()}`,
  );
}

export async function fetchSprintRun(runId: string) {
  return getJson<SprintRunDetail>(`/api/sprints/intelligence/runs/${runId}`);
}

export async function fetchSprintIssueEvaluations(
  runId: string,
  filters: IssueFilters,
) {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === "") return;
    search.set(key, String(value));
  });
  return getJson<Paginated<SprintIssueListItem>>(
    `/api/sprints/intelligence/runs/${runId}/issues?${search.toString()}`,
  );
}

export async function fetchSprintIssueEvaluation(
  runId: string,
  evaluationId: string,
) {
  return getJson<{
    evaluation: SprintIssueListItem & {
      removalTimestamp: string | null;
      eventResolutionDetails: unknown;
    };
    reasonPresentations: Array<{
      code: string;
      title: string;
      explanation: string;
      severity: string;
      suggestedAction?: string;
    }>;
    labelActions: LabelActionItem[];
    sprint: {
      milestoneId: number;
      milestoneTitle: string;
      startDate: string | null;
      dueDate: string | null;
      timezone: string;
    } | null;
  }>(`/api/sprints/intelligence/runs/${runId}/issues/${evaluationId}`);
}

export async function fetchSprintLabelActions(
  runId: string,
  params: { page?: number; pageSize?: number; action?: string; status?: string },
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") search.set(key, String(value));
  });
  return getJson<Paginated<LabelActionItem>>(
    `/api/sprints/intelligence/runs/${runId}/label-actions?${search.toString()}`,
  );
}

export async function fetchSprintFailures(runId: string) {
  return getJson<{
    runId: string;
    runStatus: string;
    runErrorCode: string | null;
    runErrorMessage: string | null;
    summaryFailures: unknown;
    issueFailures: Array<{
      id: string;
      projectId: number;
      issueIid: number;
      issueTitle: string;
      planningStatus: string;
      deliveryStatus: string;
      evaluationErrorCode: string | null;
      evaluationErrorMessage: string | null;
      reasons: Array<{
        code: string;
        title: string;
        explanation: string;
        severity: string;
        suggestedAction?: string;
      }>;
      createdAt: string;
    }>;
    actionFailures: LabelActionItem[];
  }>(`/api/sprints/intelligence/runs/${runId}/failures`);
}

export async function fetchSprintIntelligenceConfig() {
  return getJson<ConfigView>("/api/sprints/intelligence/config");
}

export async function requestSprintAnalysis(body: {
  projectIds: number[];
  milestone: {
    id: number;
    title: string;
    startDate: string | null;
    dueDate: string | null;
  };
}) {
  const response = await fetch("/api/sprints/intelligence/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<{
    runId: string;
    status: string;
    jobId: string | null;
    reused: boolean;
  }>;
}

export async function requestSprintApply(body: {
  sourceAnalysisRunId: string;
  confirm: true;
}) {
  const response = await fetch("/api/sprints/intelligence/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<{
    runId: string;
    status: string;
    jobId: string | null;
    reused: boolean;
  }>;
}

export function buildExportUrl(
  runId: string,
  type: "issues" | "label-actions",
  filters?: Partial<IssueFilters>,
) {
  const search = new URLSearchParams({ runId, type });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (
        value == null ||
        value === "" ||
        key === "page" ||
        key === "pageSize" ||
        key === "sortBy" ||
        key === "sortDir"
      ) {
        continue;
      }
      search.set(key, String(value));
    }
  }
  return `/api/sprints/intelligence/export?${search.toString()}`;
}
