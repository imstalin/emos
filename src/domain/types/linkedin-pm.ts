export type LinkedInPostType =
  | "weekly_update"
  | "milestone"
  | "thought_leadership"
  | "team_culture"
  | "product_vision";

export type LinkedInTone = "professional" | "conversational" | "celebratory";

export type LinkedInTimeRange = "week" | "month" | "quarter";

export interface LinkedInSuggestionsRequest {
  postType: LinkedInPostType;
  tone: LinkedInTone;
  timeRange: LinkedInTimeRange;
  anonymizeTeam: boolean;
  customFocus?: string;
}

export interface LinkedInPostSuggestion {
  id: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  angle: string;
  sourceRefs: string[];
}

export interface LinkedInContextSummary {
  generatedAt: string;
  timeRange: LinkedInTimeRange;
  highlights: string[];
  stats: {
    recentActivityCount: number;
    openFollowUps: number;
    criticalFollowUps: number;
    teamUtilization: number | null;
    releaseHeadline: string | null;
    roadmapThemes: string[];
  };
}

export interface LinkedInSuggestionsResponse {
  generatedAt: string;
  contextSummary: LinkedInContextSummary;
  suggestions: LinkedInPostSuggestion[];
}

export const LINKEDIN_POST_TYPE_LABELS: Record<LinkedInPostType, string> = {
  weekly_update: "Weekly delivery update",
  milestone: "Release milestone",
  thought_leadership: "Thought leadership",
  team_culture: "Team & culture",
  product_vision: "Product vision",
};

export const LINKEDIN_TONE_LABELS: Record<LinkedInTone, string> = {
  professional: "Professional",
  conversational: "Conversational",
  celebratory: "Celebratory",
};

export const LINKEDIN_TIME_RANGE_LABELS: Record<LinkedInTimeRange, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
};

export const LINKEDIN_SUGGESTED_FOCUS = [
  "Monthly release epic progress",
  "How we run FY planning",
  "Unblocking the team",
  "Shipping vs. quality tradeoffs",
  "What I learned from sprint delivery",
] as const;
