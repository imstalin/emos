export interface FollowUpTicketComment {
  id: number;
  authorName: string;
  authorUsername: string;
  body: string;
  createdAt: string;
}

export interface FollowUpTicketContext {
  followUpId: string;
  workItemId: string;
  title: string;
  type: string;
  description: string | null;
  webUrl: string | null;
  comments: FollowUpTicketComment[];
  commentsSource: "gitlab" | "none" | "unavailable";
}
