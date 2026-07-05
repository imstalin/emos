import OpenAI from "openai";
import { z } from "zod";

import type {
  AIReplyRequest,
  AIReplyResponse,
  CommentTargetType,
  ReplyTone,
  SuggestedGitLabAction,
  WorkItemContextForAI,
} from "@/domain/types/gitlab-comments-monitor";
import { getOpenAIConfig } from "@/lib/openai-config";
import { logger } from "@/lib/logger";
import {
  generateRuleBasedActions,
  mergeSuggestedActions,
} from "@/server/services/gitlab-comments-monitor/workflow-rules";

const actionSchema = z.object({
  type: z.enum([
    "reply",
    "label_update",
    "status_update",
    "assignee_update",
    "milestone_update",
    "due_date_update",
    "epic_update",
    "close_issue",
    "mr_review",
    "release_note",
  ]),
  recommendation: z.string(),
  reason: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  payload: z.record(z.string(), z.unknown()),
  requiresConfirmation: z.boolean().default(true),
});

const aiResponseSchema = z.object({
  contextSummary: z.string(),
  rewrittenReply: z.string(),
  suggestedActions: z.array(actionSchema),
});

const TONE_GUIDANCE: Record<ReplyTone, string> = {
  professional:
    "Formal, clear, and respectful. Suitable for cross-team GitLab threads.",
  friendly: "Warm and collaborative while staying professional.",
  firm: "Direct and accountability-focused without being harsh.",
  short: "Minimal words — one or two sentences maximum.",
  executive:
    "Concise leadership update: status, risk, and next step only.",
};

const SYSTEM_PROMPT = `You are an Engineering Manager assistant for GitLab issue and merge request threads.

Return ONLY valid JSON matching this schema:
{
  "contextSummary": "1-2 sentence summary of the thread state",
  "rewrittenReply": "Professional GitLab comment ready to post",
  "suggestedActions": [
    {
      "type": "reply | label_update | status_update | assignee_update | milestone_update | due_date_update | epic_update | close_issue | mr_review | release_note",
      "recommendation": "Short action title",
      "reason": "Why this action helps",
      "confidence": "low | medium | high",
      "payload": {},
      "requiresConfirmation": true
    }
  ]
}

Rules:
- Never invent ticket numbers, dates, or people not in context
- Keep rewrittenReply under 120 words unless executive tone needs slightly more
- suggestedActions payload examples:
  - reply: { "body": "comment text" }
  - label_update: { "add_labels": "QA", "remove_labels": "In Progress" }
  - status_update: { "state_event": "close" } for issues
  - assignee_update: { "assignee_id": 123 } or { "assignee_ids": [123] }
  - milestone_update: { "milestone_id": 456 }
  - due_date_update: { "due_date": "2026-07-15" }
  - epic_update: { "epicIid": 12 }
  - close_issue: { "state_event": "close" }
  - mr_review: { "action": "request_review", "body": "optional comment" }
  - release_note: { "add_labels": "release-note" }
- All actions must have requiresConfirmation: true
- Suggest 1-4 actions maximum, only when clearly warranted`;

function buildContextPrompt(
  context: WorkItemContextForAI,
  targetType: CommentTargetType,
): string {
  const workItem = context.issue ?? context.mergeRequest;
  if (!workItem) return "No work item context.";

  const notesText = context.notes
    .filter((n) => !n.system && n.body?.trim())
    .slice(-10)
    .map(
      (n) =>
        `- ${n.author.name} (@${n.author.username}) ${n.created_at}: ${n.body.slice(0, 500)}`,
    )
    .join("\n");

  const epicLine = context.epic
    ? `Epic: ${context.epic.title} (#${context.epic.iid})`
    : "Epic: none";

  const pipelineLine = context.pipeline
    ? `Pipeline: ${context.pipeline.status} (${context.pipeline.web_url})`
    : "Pipeline: n/a";

  return `
Target type: ${targetType}
Title: ${workItem.title}
State: ${"state" in workItem ? workItem.state : "unknown"}
Labels: ${workItem.labels.join(", ") || "none"}
Assignee: ${workItem.assignee?.name ?? "unassigned"}
${context.issue?.milestone ? `Milestone: ${context.issue.milestone.title}` : "Milestone: none"}
${context.issue?.due_date ? `Due date: ${context.issue.due_date}` : ""}
${epicLine}
${targetType === "merge_request" && context.mergeRequest ? `Merge status: ${context.mergeRequest.merge_status}, draft: ${context.mergeRequest.draft}` : ""}
${targetType === "merge_request" ? pipelineLine : ""}

Description:
${workItem.description?.slice(0, 1500) ?? "(empty)"}

Recent comments:
${notesText || "(none)"}
`.trim();
}

export class CommentsMonitorAiService {
  async generateAIReply(
    request: AIReplyRequest,
    context: WorkItemContextForAI,
  ): Promise<AIReplyResponse> {
    const config = getOpenAIConfig();
    if (!config) {
      throw new Error(
        "OpenAI is not configured. Set OPENAI_API_KEY in your .env file.",
      );
    }

    const ruleBased = generateRuleBasedActions(
      request.roughText,
      request.targetType,
      context,
    );

    const client = new OpenAI({ apiKey: config.apiKey });
    const toneGuide = TONE_GUIDANCE[request.tone];

    const userPrompt = `
Tone: ${request.tone} — ${toneGuide}

Manager's rough input:
${request.roughText}

Work item context:
${buildContextPrompt(context, request.targetType)}

Rewrite the rough input into a GitLab comment and suggest follow-up GitLab actions.
`.trim();

    try {
      const completion = await client.chat.completions.create({
        model: config.model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed = aiResponseSchema.parse(JSON.parse(raw));
      const aiActions: SuggestedGitLabAction[] = parsed.suggestedActions.map(
        (action) => ({
          ...action,
          requiresConfirmation: true,
        }),
      );

      return {
        contextSummary: parsed.contextSummary,
        rewrittenReply: parsed.rewrittenReply,
        suggestedActions: mergeSuggestedActions(ruleBased, aiActions),
      };
    } catch (error) {
      logger.error("Comments monitor AI failed", { error });
      if (ruleBased.length > 0) {
        return {
          contextSummary: "AI unavailable — showing rule-based suggestions only.",
          rewrittenReply: request.roughText,
          suggestedActions: ruleBased,
        };
      }
      throw error instanceof Error ? error : new Error("AI reply generation failed");
    }
  }

  generateNextActions(
    commentBody: string,
    targetType: CommentTargetType,
    context: WorkItemContextForAI,
  ): SuggestedGitLabAction[] {
    return generateRuleBasedActions(commentBody, targetType, context);
  }
}

export const commentsMonitorAiService = new CommentsMonitorAiService();
