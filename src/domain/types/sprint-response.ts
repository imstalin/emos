export interface SprintResponseMilestoneOption {
  id: number;
  title: string;
  state: string;
  startDate: string | null;
  dueDate: string | null;
}

export interface SprintResponseIssue {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  state: "opened" | "closed";
  webUrl: string;
  authorUsername: string | null;
  assignees: Array<{ username: string; name: string }>;
  labels: string[];
  statusLabel: string | null;
  typeLabel: string | null;
  humanNoteCount: number;
  developerNoteCount: number;
  assigneeNoteCount: number;
  hasDeveloperResponse: boolean;
  hasAssigneeResponse: boolean;
  lastDeveloperUsername: string | null;
  lastDeveloperAt: string | null;
}

export interface SprintResponseDeveloperNudge {
  username: string;
  name: string;
  assignedCount: number;
  respondedCount: number;
  unansweredCount: number;
  unansweredIssues: SprintResponseIssue[];
  nudgeMessage: string;
}

export interface SprintResponseByStatus {
  status: string;
  total: number;
  responded: number;
  unanswered: number;
}

export interface SprintResponseSummary {
  generatedAt: string;
  milestone: SprintResponseMilestoneOption | null;
  milestones: SprintResponseMilestoneOption[];
  boardUrl: string | null;
  totalIssues: number;
  openedCount: number;
  closedCount: number;
  withDeveloperResponse: number;
  withoutDeveloperResponse: number;
  withAssigneeResponse: number;
  responseRate: number;
  byStatus: SprintResponseByStatus[];
  issues: SprintResponseIssue[];
  unansweredIssues: SprintResponseIssue[];
  developersToNudge: SprintResponseDeveloperNudge[];
  fullyRespondedDevelopers: Array<{
    username: string;
    name: string;
    assignedCount: number;
  }>;
  unassignedUnanswered: SprintResponseIssue[];
}
