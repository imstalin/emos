import type {
  GitLabConnectionTest,
  GitLabCreateIssuePayload,
  GitLabEpic,
  GitLabGroup,
  GitLabIssue,
  GitLabIssueLink,
  GitLabIssueTimeStats,
  GitLabJob,
  GitLabLabel,
  GitLabMergeRequest,
  GitLabMilestone,
  GitLabCreateMilestonePayload,
  GitLabUpdateMilestonePayload,
  GitLabNote,
  GitLabPipeline,
  GitLabProject,
  GitLabTag,
  GitLabCommit,
  GitLabUpdateIssuePayload,
  GitLabUpdateMergeRequestPayload,
  GitLabUser,
} from "@/domain/types/gitlab";

export interface GitLabProvider {
  testConnection(): Promise<GitLabConnectionTest>;
  getGroup(groupId: string | number): Promise<GitLabGroup>;
  listGroupProjects(): Promise<GitLabProject[]>;
  listGroupProjectsByGroup(
    groupId: string | number,
    options?: { includeSubgroups?: boolean },
  ): Promise<GitLabProject[]>;
  listProjectTags(projectId: number, maxPages?: number): Promise<GitLabTag[]>;
  listProjectCommits(
    projectId: number,
    refName: string,
    maxPages?: number,
  ): Promise<GitLabCommit[]>;
  listGroupMembers(): Promise<GitLabUser[]>;
  getProject(projectId: number): Promise<GitLabProject>;
  listProjectIssues(
    projectId: number,
    state?: "opened" | "closed" | "all",
    options?: { updatedAfter?: string; maxPages?: number },
  ): Promise<GitLabIssue[]>;
  listProjectMergeRequests(projectId: number): Promise<GitLabMergeRequest[]>;
  getIssue(projectId: number, issueIid: number): Promise<GitLabIssue>;
  getMergeRequest(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabMergeRequest>;
  listIssueNotes(projectId: number, issueIid: number): Promise<GitLabNote[]>;
  listMergeRequestNotes(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabNote[]>;
  createIssueNote(
    projectId: number,
    issueIid: number,
    body: string,
  ): Promise<GitLabNote>;
  createMergeRequestNote(
    projectId: number,
    mergeRequestIid: number,
    body: string,
  ): Promise<GitLabNote>;
  updateIssue(
    projectId: number,
    issueIid: number,
    payload: GitLabUpdateIssuePayload,
  ): Promise<GitLabIssue>;
  updateMergeRequest(
    projectId: number,
    mergeRequestIid: number,
    payload: GitLabUpdateMergeRequestPayload,
  ): Promise<GitLabMergeRequest>;
  listProjectMilestones(
    projectId: number,
    state?: "active" | "closed" | "all",
  ): Promise<GitLabMilestone[]>;
  createProjectMilestone(
    projectId: number,
    payload: GitLabCreateMilestonePayload,
  ): Promise<GitLabMilestone>;
  listGroupMilestones(
    groupId: number,
    state?: "active" | "closed" | "all",
  ): Promise<GitLabMilestone[]>;
  createGroupMilestone(
    groupId: number,
    payload: GitLabCreateMilestonePayload,
  ): Promise<GitLabMilestone>;
  updateGroupMilestone(
    groupId: number,
    milestoneId: number,
    payload: GitLabUpdateMilestonePayload,
  ): Promise<GitLabMilestone>;
  listProjectLabels(projectId: number): Promise<GitLabLabel[]>;
  listIssueLinks(projectId: number, issueIid: number): Promise<GitLabIssueLink[]>;
  listMergeRequestPipelines(
    projectId: number,
    mergeRequestIid: number,
  ): Promise<GitLabPipeline[]>;
  listProjectPipelines(
    projectId: number,
    ref: string,
    maxPages?: number,
  ): Promise<GitLabPipeline[]>;
  listPipelineJobs(
    projectId: number,
    pipelineId: number,
  ): Promise<GitLabJob[]>;
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
  getCurrentUser(): Promise<GitLabUser>;
}
