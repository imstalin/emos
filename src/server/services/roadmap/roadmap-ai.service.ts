import OpenAI from "openai";

import type {
  RoadmapAiDescriptionRequest,
  RoadmapAiDescriptionResponse,
} from "@/domain/types/roadmap-gitlab";
import { getOpenAIConfig } from "@/lib/openai-config";
import { logger } from "@/lib/logger";

const SYSTEM_PROMPT = `You write concise engineering issue descriptions for a FY27 product roadmap.
Write in clear professional English suitable for a GitLab issue in an enterprise admin platform project.
Use short paragraphs and bullet lists for acceptance criteria when helpful.
Do not include markdown headings like # or ##.
Keep descriptions under 200 words unless rewriting a long existing description.
Do not invent dates, URLs, or ticket numbers.`;

export class RoadmapAiService {
  async generateDescription(
    input: RoadmapAiDescriptionRequest,
  ): Promise<RoadmapAiDescriptionResponse> {
    const config = getOpenAIConfig();
    if (!config) {
      throw new Error(
        "OpenAI is not configured. Set OPENAI_API_KEY in your .env file.",
      );
    }

    const client = new OpenAI({ apiKey: config.apiKey });
    const userPrompt =
      input.mode === "rewrite"
        ? `Rewrite and improve this roadmap item description for clarity and actionability.

Title: ${input.title}
Project: ${input.project}
Category: ${input.category}
Priority: ${input.priority}
Quarter: ${input.quarter}
Assignee: ${input.assignee || "Unassigned"}

Current description:
${input.description?.trim() || "(empty)"}`
        : `Generate a new GitLab-ready description for this FY27 roadmap item.

Title: ${input.title}
Project: ${input.project}
Category: ${input.category}
Priority: ${input.priority}
Quarter: ${input.quarter}
Assignee: ${input.assignee || "Unassigned"}

Include: problem/context, scope, and 2-4 acceptance criteria bullets.`;

    try {
      const completion = await client.chat.completions.create({
        model: config.model,
        temperature: 0.5,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const description = completion.choices[0]?.message?.content?.trim();
      if (!description) {
        throw new Error("Empty response from OpenAI");
      }

      return { description };
    } catch (error) {
      logger.error("Roadmap AI description failed", { error });
      throw error instanceof Error ? error : new Error("AI description failed");
    }
  }
}

export const roadmapAiService = new RoadmapAiService();
