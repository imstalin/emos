import type { GitLabEpic, GitLabIssue, GitLabMergeRequest, GitLabNote, GitLabPipeline } from "@/domain/types/gitlab";

export type CommentTargetType = "issue" | "merge_request";

export type ReplyTone =
  | "professional"
  | "friendly"
  | "firm"
  | "short"
  | "executive";

export type SuggestedActionType =
  | "reply"
  | "label_update"
  | "status_update"
  | "assignee_update"
  | "milestone_update"
  | "due_date_update"
  | "epic_update"
  | "close_issue"
  | "mr_review"
  | "release_note";

export type ActionConfidence = "low" | "medium" | "high";

export interface CommentFeedItem {
  id: string;
  noteId: number;
  targetType: CommentTargetType;
  projectId: number;
  projectName: string;
  targetIid: number;
  targetId: number;
  targetTitle: string;
  targetState: string;
  targetWebUrl: string;
  body: string;
  authorName: string;
  authorUsername: string;
  authorId: number;
  createdAt: string;
  labels: string[];
  assigneeName: string | null;
  assigneeUsername: string | null;
  milestoneTitle: string | null;
  epicIid: number | null;
  epicTitle: string | null;
  needsAction: boolean;
  mentionsMe: boolean;
  mentionsTeam: boolean;
}

export interface CommentFeedFilters {
  projectId?: number;
  author?: string;
  assignee?: string;
  label?: string;
  state?: string;
  targetType?: CommentTargetType | "all";
  dateFrom?: string;
  dateTo?: string;
  unansweredOnly?: boolean;
  needsActionOnly?: boolean;
  mentionsOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CommentFeedResult {
  items: CommentFeedItem[];
  total: number;
  page: number;
  limit: number;
  projects: Array<{ id: number; name: string; count: number }>;
  authors: string[];
  assignees: string[];
  labels: string[];
  currentUser: { id: number; username: string; name: string } | null;
}

export interface CommentDiscussionNote {
  id: number;
  body: string;
  authorName: string;
  authorUsername: string;
  createdAt: string;
  system: boolean;
}

export interface CommentContextPanel {
  targetType: CommentTargetType;
  projectId: number;
  projectName: string;
  targetIid: number;
  targetId: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  assignee: { id: number; name: string; username: string } | null;
  milestone: { id: number; title: string } | null;
  epic: { iid: number; title: string; webUrl: string } | null;
  dueDate: string | null;
  webUrl: string;
  previousComments: CommentDiscussionNote[];
  linkedIssues: Array<{ iid: number; title: string; state: string; webUrl: string }>;
  pipeline: GitLabPipeline | null;
  mergeStatus: string | null;
  reviewers: Array<{ id: number; name: string; username: string }>;
  draft: boolean | null;
  availableLabels: string[];
  availableMilestones: Array<{ id: number; title: string }>;
  availableEpics: Array<{ iid: number; title: string }>;
  availableAssignees: Array<{ id: number; name: string; username: string }>;
}

export interface SuggestedGitLabAction {
  type: SuggestedActionType;
  recommendation: string;
  reason: string;
  confidence: ActionConfidence;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export interface AIReplyResponse {
  contextSummary: string;
  rewrittenReply: string;
  suggestedActions: SuggestedGitLabAction[];
}

export interface AIReplyRequest {
  roughText: string;
  tone: ReplyTone;
  commentId: string;
  targetType: CommentTargetType;
  projectId: number;
  targetIid: number;
}

export interface ApplyActionRequest {
  actionType: SuggestedActionType;
  targetType: CommentTargetType;
  projectId: number;
  targetIid: number;
  payload: Record<string, unknown>;
}

export interface ApplyActionResult {
  ok: boolean;
  auditId: string;
  message: string;
  error?: string;
}

export interface GitLabActionAuditEntry {
  id: string;
  actionType: string;
  targetType: string;
  projectId: number;
  targetIid: number;
  payload: Record<string, unknown>;
  result: "success" | "failed";
  error: string | null;
  createdAt: string;
}

export interface WorkItemContextForAI {
  issue?: GitLabIssue;
  mergeRequest?: GitLabMergeRequest;
  notes: GitLabNote[];
  epic?: GitLabEpic | null;
  pipeline?: GitLabPipeline | null;
}
