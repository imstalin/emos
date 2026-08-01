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
import { DELIVERY_COACH_SYSTEM_PROMPT } from "@/server/services/assistant/delivery-coach-prompt";

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
      DELIVERY_COACH_SYSTEM_PROMPT,
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
