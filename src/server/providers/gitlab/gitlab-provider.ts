import type {
  GitLabConnectionTest,
  GitLabCreateIssuePayload,
  GitLabEpic,
  GitLabIssue,
  GitLabIssueTimeStats,
  GitLabMergeRequest,
  GitLabMilestone,
  GitLabNote,
  GitLabProject,
  GitLabUser,
} from "@/domain/types/gitlab";

export interface GitLabProvider {
  testConnection(): Promise<GitLabConnectionTest>;
  listGroupProjects(): Promise<GitLabProject[]>;
  listGroupMembers(): Promise<GitLabUser[]>;
  getProject(projectId: number): Promise<GitLabProject>;
  listProjectIssues(projectId: number): Promise<GitLabIssue[]>;
  listProjectMergeRequests(projectId: number): Promise<GitLabMergeRequest[]>;
  listIssueNotes(projectId: number, issueIid: number): Promise<GitLabNote[]>;
  listMergeRequestNotes(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabNote[]>;
  listProjectMilestones(
    projectId: number,
    state?: "active" | "closed" | "all",
  ): Promise<GitLabMilestone[]>;
  createProjectIssue(
    projectId: number,
    payload: GitLabCreateIssuePayload,
  ): Promise<GitLabIssue>;
  getIssueTimeStats(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssueTimeStats>;
  listGroupEpics(
    state?: "opened" | "closed" | "all",
  ): Promise<GitLabEpic[]>;
  listEpicIssues(epicIid: number): Promise<GitLabIssue[]>;
  assignIssueToEpic(epicIid: number, issueId: number): Promise<void>;
}
