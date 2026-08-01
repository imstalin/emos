import OpenAI from "openai";

import type {
  RoadmapAiDescriptionRequest,
  RoadmapAiDescriptionResponse,
} from "@/domain/types/roadmap-gitlab";
import { getOpenAIConfig } from "@/lib/openai-config";
import { logger } from "@/lib/logger";

const SYSTEM_PROMPT = `You write concise GitLab-ready titles and descriptions for a FY27 product roadmap.
Write in clear professional English suitable for a GitLab issue in an enterprise admin platform project.
Return ONLY valid JSON with keys "aiTitle" and "aiDescription".
aiTitle: a short actionable issue title (max ~100 characters), no trailing period.
aiDescription: short paragraphs and bullet lists for acceptance criteria when helpful; under 200 words; no markdown headings like # or ##.
Do not invent dates, URLs, or ticket numbers.`;

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI response was not valid JSON");
  }
}

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
        ? `Rewrite and improve this roadmap item for a GitLab issue (title + description).

Planning title: ${input.title}
Project: ${input.project}
Category: ${input.category}
Priority: ${input.priority}
Quarter: ${input.quarter}
Assignee: ${input.assignee || "Unassigned"}

Current planning description:
${input.description?.trim() || "(empty)"}

Current AI title (if any):
${input.aiTitle?.trim() || "(empty)"}

Current AI description (if any):
${input.aiDescription?.trim() || "(empty)"}

Return improved aiTitle and aiDescription as JSON.`
        : `Generate a GitLab-ready title and description for this FY27 roadmap item.

Planning title: ${input.title}
Project: ${input.project}
Category: ${input.category}
Priority: ${input.priority}
Quarter: ${input.quarter}
Assignee: ${input.assignee || "Unassigned"}

Planning description (context):
${input.description?.trim() || "(empty)"}

aiDescription should include: problem/context, scope, and 2-4 acceptance criteria bullets.
Return aiTitle and aiDescription as JSON.`;

    try {
      const completion = await client.chat.completions.create({
        model: config.model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed = extractJsonObject(content) as {
        aiTitle?: unknown;
        aiDescription?: unknown;
        title?: unknown;
        description?: unknown;
      };

      const aiTitle = String(parsed.aiTitle ?? parsed.title ?? "").trim();
      const aiDescription = String(
        parsed.aiDescription ?? parsed.description ?? "",
      ).trim();

      if (!aiTitle || !aiDescription) {
        throw new Error("AI response missing aiTitle or aiDescription");
      }

      return { aiTitle, aiDescription };
    } catch (error) {
      logger.error("Roadmap AI description failed", { error });
      throw error instanceof Error ? error : new Error("AI description failed");
    }
  }
}

export const roadmapAiService = new RoadmapAiService();
