const SUPPORTED_OBJECT_KINDS = new Set([
  "issue",
  "merge_request",
  "pipeline",
]);

export type GitLabWebhookPayload = {
  object_kind?: string;
  event_name?: string;
  project?: {
    id?: number;
    path_with_namespace?: string;
  };
  object_attributes?: {
    id?: number;
    iid?: number;
    state?: string;
  };
};

export function parseGitLabWebhookPayload(
  payload: GitLabWebhookPayload,
): {
  supported: boolean;
  gitlabProjectId: number | null;
  objectKind: string | null;
} {
  const objectKind = payload.object_kind ?? null;
  const gitlabProjectId = payload.project?.id ?? null;

  if (!objectKind || !gitlabProjectId) {
    return { supported: false, gitlabProjectId, objectKind };
  }

  return {
    supported: SUPPORTED_OBJECT_KINDS.has(objectKind),
    gitlabProjectId,
    objectKind,
  };
}
