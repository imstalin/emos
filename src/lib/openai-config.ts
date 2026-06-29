export type OpenAIConfig = {
  apiKey: string;
  model: string;
};

export function getOpenAIConfig(): OpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
}

export function getAssistantStatus() {
  const config = getOpenAIConfig();
  return {
    configured: config !== null,
    model: config?.model ?? null,
  };
}
