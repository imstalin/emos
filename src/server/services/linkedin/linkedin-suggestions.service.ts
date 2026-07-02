import OpenAI from "openai";
import { z } from "zod";

import type {
  LinkedInPostSuggestion,
  LinkedInSuggestionsRequest,
  LinkedInSuggestionsResponse,
} from "@/domain/types/linkedin-pm";
import {
  LINKEDIN_POST_TYPE_LABELS,
  LINKEDIN_TONE_LABELS,
} from "@/domain/types/linkedin-pm";
import { getOpenAIConfig } from "@/lib/openai-config";
import { logger } from "@/lib/logger";
import {
  buildLinkedInContextSummary,
  formatLinkedInContextForAi,
} from "@/server/services/linkedin/linkedin-context.service";

const suggestionSchema = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  angle: z.string(),
  sourceRefs: z.array(z.string()),
});

const responseSchema = z.object({
  suggestions: z.array(suggestionSchema).min(1).max(5),
});

const SYSTEM_PROMPT = `You are an AI product manager coach helping an engineering leader write authentic LinkedIn posts.

Rules:
- Use ONLY facts from the provided activity context. Never invent metrics, launches, customers, or team outcomes.
- Do not include internal URLs, GitLab links, ticket numbers, or confidential project codes.
- Write in first person as the engineering/product leader.
- Each post needs: a scroll-stopping hook (1 line), body (120-220 words), a short CTA, 3-6 relevant hashtags.
- Provide exactly 3 post variants with different angles (e.g. lesson learned, team win, process insight).
- If anonymizeTeam is true, never use real people's names.
- Keep tone aligned with the requested style.
- Return valid JSON only, matching the schema described in the user message.`;

export class LinkedInSuggestionsService {
  async generate(
    input: LinkedInSuggestionsRequest,
  ): Promise<LinkedInSuggestionsResponse> {
    const config = getOpenAIConfig();
    if (!config) {
      throw new Error(
        "OpenAI is not configured. Set OPENAI_API_KEY in your .env file.",
      );
    }

    const contextSummary = await buildLinkedInContextSummary(
      input.timeRange,
      input.anonymizeTeam,
    );
    const contextBlock = formatLinkedInContextForAi(contextSummary);

    const userPrompt = `
Generate LinkedIn post ideas based on this EMOS activity snapshot.

Post type: ${LINKEDIN_POST_TYPE_LABELS[input.postType]}
Tone: ${LINKEDIN_TONE_LABELS[input.tone]}
Anonymize team names: ${input.anonymizeTeam ? "yes" : "no"}
${input.customFocus?.trim() ? `Extra focus: ${input.customFocus.trim()}` : ""}

${contextBlock}

Return JSON:
{
  "suggestions": [
    {
      "hook": "opening line",
      "body": "main post text with line breaks as \\n",
      "cta": "closing call to action",
      "hashtags": ["ProductManagement", "..."],
      "angle": "short label for this variant",
      "sourceRefs": ["which context bullets inspired this post"]
    }
  ]
}
`.trim();

    const client = new OpenAI({ apiKey: config.apiKey });

    try {
      const completion = await client.chat.completions.create({
        model: config.model,
        temperature: 0.65,
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

      const parsed = responseSchema.parse(JSON.parse(raw));
      const suggestions: LinkedInPostSuggestion[] = parsed.suggestions.map(
        (entry) => ({
          id: crypto.randomUUID(),
          ...entry,
        }),
      );

      return {
        generatedAt: new Date().toISOString(),
        contextSummary,
        suggestions,
      };
    } catch (error) {
      logger.error("LinkedIn suggestions generation failed", { error });
      throw error instanceof Error
        ? error
        : new Error("LinkedIn suggestions failed");
    }
  }
}

export const linkedInSuggestionsService = new LinkedInSuggestionsService();
