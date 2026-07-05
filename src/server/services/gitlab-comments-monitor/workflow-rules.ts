import type {
  CommentTargetType,
  SuggestedGitLabAction,
  WorkItemContextForAI,
} from "@/domain/types/gitlab-comments-monitor";

const COMPLETED_PATTERNS =
  /\b(done|completed|finished|fixed|resolved|ready for review|ready for qa|implemented)\b/i;
const QA_PASSED_PATTERNS =
  /\b(qa passed|qa approved|validated|testing passed|verified in qa)\b/i;
const BLOCKED_PATTERNS =
  /\b(blocked|blocker|waiting on|dependency|cannot proceed)\b/i;
const CUSTOMER_IMPACT_PATTERNS =
  /\b(production|customer|client|outage|incident|hotfix|p0|p1)\b/i;
const ETA_PATTERNS = /\b(eta|timeline|when will|status update|any update)\b/i;
const RELEASE_PATTERNS =
  /\b(release|deploy|production ready|merge after|ship)\b/i;

function action(
  partial: SuggestedGitLabAction,
): SuggestedGitLabAction {
  return { requiresConfirmation: true, ...partial };
}

export function generateRuleBasedActions(
  commentBody: string,
  targetType: CommentTargetType,
  context: WorkItemContextForAI,
): SuggestedGitLabAction[] {
  const actions: SuggestedGitLabAction[] = [];
  const labels =
    context.issue?.labels ?? context.mergeRequest?.labels ?? [];
  const state = context.issue?.state ?? context.mergeRequest?.state ?? "";
  const pipeline = context.pipeline;
  const mergeStatus = context.mergeRequest?.merge_status;
  const body = commentBody.toLowerCase();

  if (COMPLETED_PATTERNS.test(body)) {
    if (!labels.some((l) => /qa|review/i.test(l))) {
      actions.push(
        action({
          type: "label_update",
          recommendation: 'Add "In Review" or "QA" label',
          reason: "Comment indicates work is completed — move to review/QA.",
          confidence: "high",
          payload: { add_labels: "QA" },
        }),
      );
    }
    actions.push(
      action({
        type: "reply",
        recommendation: "Acknowledge completion and request QA validation",
        reason: "Work completion should be confirmed with QA handoff.",
        confidence: "medium",
        payload: {
          body: "Thanks for the update. Please hand this off to QA for validation and share results here.",
        },
      }),
    );
  }

  if (QA_PASSED_PATTERNS.test(body)) {
    actions.push(
      action({
        type: "label_update",
        recommendation: 'Add "Ready for Release" label',
        reason: "QA passed — suggest release readiness.",
        confidence: "high",
        payload: { add_labels: "Ready for Release" },
      }),
    );
    if (state === "opened" && targetType === "issue") {
      actions.push(
        action({
          type: "status_update",
          recommendation: "Move issue toward Done",
          reason: "QA validation passed.",
          confidence: "medium",
          payload: { add_labels: "Done", remove_labels: "QA" },
        }),
      );
    }
  }

  if (BLOCKED_PATTERNS.test(body) || labels.some((l) => /blocked/i.test(l))) {
    actions.push(
      action({
        type: "label_update",
        recommendation: 'Add "Blocked" label',
        reason: "Blocker mentioned — track explicitly.",
        confidence: "high",
        payload: { add_labels: "Blocked" },
      }),
    );
    actions.push(
      action({
        type: "reply",
        recommendation: "Ask for blocker owner and ETA",
        reason: "Blocked items need owner and expected resolution.",
        confidence: "high",
        payload: {
          body: "Thanks for flagging the blocker. Who owns resolving this, and what is the expected ETA?",
        },
      }),
    );
  }

  if (CUSTOMER_IMPACT_PATTERNS.test(body)) {
    actions.push(
      action({
        type: "label_update",
        recommendation: 'Add "Customer Impact" and "High Priority" labels',
        reason: "Production/customer impact detected in comment.",
        confidence: "high",
        payload: { add_labels: "Customer Impact,High Priority" },
      }),
    );
  }

  if (ETA_PATTERNS.test(body)) {
    actions.push(
      action({
        type: "reply",
        recommendation: "Request ETA from assignee",
        reason: "Comment asks for timeline or status.",
        confidence: "medium",
        payload: {
          body: "Could you share an ETA and any risks that might affect delivery?",
        },
      }),
    );
  }

  if (RELEASE_PATTERNS.test(body)) {
    actions.push(
      action({
        type: "label_update",
        recommendation: 'Add "Ready for Release" label',
        reason: "Release/deployment context in comment.",
        confidence: "medium",
        payload: { add_labels: "Ready for Release" },
      }),
    );
  }

  const lastUpdated =
    context.issue?.updated_at ?? context.mergeRequest?.updated_at;
  if (lastUpdated) {
    const daysSinceUpdate =
      (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 7 && state === "opened") {
      actions.push(
        action({
          type: "reply",
          recommendation: "Ask for ETA on stale item",
          reason: "No update for over 7 days.",
          confidence: "medium",
          payload: {
            body: "This item has been quiet for a while. Can you share a quick status update and ETA?",
          },
        }),
      );
    }
  }

  if (targetType === "merge_request" && context.mergeRequest) {
    if (pipeline?.status === "failed") {
      actions.push(
        action({
          type: "reply",
          recommendation: "Ask developer to fix failing pipeline",
          reason: "MR pipeline is failing.",
          confidence: "high",
          payload: {
            body: "The pipeline is failing on this MR. Please investigate and fix before we proceed with review.",
          },
        }),
      );
    }

    if (
      context.mergeRequest.blocking_discussions_resolved === false ||
      mergeStatus === "cannot_be_merged"
    ) {
      actions.push(
        action({
          type: "mr_review",
          recommendation: "Keep MR in review — unresolved threads or conflicts",
          reason: "Merge is blocked by discussions or conflicts.",
          confidence: "high",
          payload: { action: "keep_in_review" },
        }),
      );
    }

    if (
      pipeline?.status === "success" &&
      mergeStatus === "can_be_merged" &&
      !context.mergeRequest.draft
    ) {
      actions.push(
        action({
          type: "mr_review",
          recommendation: "Post merge-ready comment",
          reason: "Pipeline passed and MR is mergeable.",
          confidence: "high",
          payload: {
            body: "Pipeline is green and approvals look good. This MR is merge-ready pending final check.",
            action: "merge_ready",
          },
        }),
      );
    }
  }

  if (
    targetType === "issue" &&
    context.issue &&
    !context.epic &&
    context.issue.state === "opened"
  ) {
    actions.push(
      action({
        type: "epic_update",
        recommendation: "Link issue to a relevant epic",
        reason: "Issue has no parent epic — improves traceability.",
        confidence: "low",
        payload: { epicIid: null },
      }),
    );
  }

  return dedupeActions(actions);
}

function dedupeActions(
  actions: SuggestedGitLabAction[],
): SuggestedGitLabAction[] {
  const seen = new Set<string>();
  return actions.filter((item) => {
    const key = `${item.type}:${item.recommendation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeSuggestedActions(
  ruleBased: SuggestedGitLabAction[],
  aiBased: SuggestedGitLabAction[],
): SuggestedGitLabAction[] {
  return dedupeActions([...ruleBased, ...aiBased]);
}
