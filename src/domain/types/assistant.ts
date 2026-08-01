export type AssistantMessageRole = "user" | "assistant";

export interface AssistantMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
}

export interface AssistantStatus {
  configured: boolean;
  model: string | null;
}

export interface AssistantChatRequest {
  messages: Array<{
    role: AssistantMessageRole;
    content: string;
  }>;
  followUpId?: string;
}

export interface AssistantChatResponse {
  message: AssistantMessage;
}

export const SUGGESTED_PROMPTS = [
  "Give me today's Delivery Coach briefing",
  "Developer-by-developer analysis with confidence scores",
  "Draft ready-to-send GitLab follow-ups for blockers",
  "Who needs attention and why?",
  "Top risks and recommended priorities for today",
] as const;
