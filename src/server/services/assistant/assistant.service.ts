import OpenAI from "openai";

import type {
  AssistantChatResponse,
  AssistantMessage,
} from "@/domain/types/assistant";
import { getOpenAIConfig } from "@/lib/openai-config";
import { logger } from "@/lib/logger";
import {
  buildAssistantContext,
  buildFollowUpContext,
} from "@/server/services/assistant/assistant-context.service";

const SYSTEM_PROMPT = `You are the AI assistant for Engineering Manager OS — a personal delivery platform for an engineering manager.

Your role:
- Help prioritize follow-ups, unblock delivery, and communicate clearly with the team
- Use the live delivery context provided below — do not invent work items or metrics
- Be concise, actionable, and manager-focused (standups, 1:1s, release decisions)
- When drafting GitLab comments, keep them professional, specific, and under 120 words
- If data is missing, say what you would need rather than guessing

When the user asks for GitLab comment help on a follow-up and ticket description/comments are provided:
- Read the full thread before replying
- Offer **2–3 reply options** labeled **Option A**, **Option B**, **Option C**
- Each option should be ready to paste into GitLab (no markdown headings inside the comment text)
- Options should differ in tone: direct action request, collaborative/check-in, escalation if needed
- Reference specific details from the description or recent comments when possible

Format responses with short paragraphs or bullet lists. Use markdown sparingly.`;

type ChatInput = {
  role: "user" | "assistant";
  content: string;
};

export class AssistantService {
  async chat(params: {
    messages: ChatInput[];
    followUpId?: string;
  }): Promise<AssistantChatResponse> {
    const config = getOpenAIConfig();
    if (!config) {
      throw new Error(
        "OpenAI is not configured. Set OPENAI_API_KEY in your .env file.",
      );
    }

    const [context, followUpContext] = await Promise.all([
      buildAssistantContext(),
      params.followUpId
        ? buildFollowUpContext(params.followUpId)
        : Promise.resolve(null),
    ]);

    const systemContent = [
      SYSTEM_PROMPT,
      context,
      followUpContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    const client = new OpenAI({ apiKey: config.apiKey });

    try {
      const completion = await client.chat.completions.create({
        model: config.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemContent },
          ...params.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const message: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      };

      return { message };
    } catch (error) {
      logger.error("Assistant chat failed", { error });
      throw error instanceof Error ? error : new Error("Assistant request failed");
    }
  }
}

export const assistantService = new AssistantService();
