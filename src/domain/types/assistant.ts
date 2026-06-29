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
  "What should I follow up on today?",
  "Who is overloaded on the team?",
  "Summarize our release readiness",
  "What are the top delivery risks right now?",
  "Draft a standup summary for my team",
] as const;
