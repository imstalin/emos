import type {
  GitLabConnectionTest,
  GitLabIssue,
  GitLabMergeRequest,
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
}
