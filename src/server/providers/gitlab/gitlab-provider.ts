import type {
  CreateGitLabLabelInput,
  EnsureGitLabLabelInput,
  EnsureLabelOptions,
  EnsureLabelsResult,
  GitLabConnectionTest,
  GitLabCreateIssuePayload,
  GitLabEpic,
  GitLabGroup,
  GitLabIssue,
  GitLabIssueLabelMutation,
  GitLabIssueLink,
  GitLabIssueTimeStats,
  GitLabJob,
  GitLabLabel,
  GitLabMergeRequest,
  GitLabMilestone,
  GitLabCreateMilestonePayload,
  GitLabUpdateMilestonePayload,
  GitLabNote,
  GitLabPaginationOptions,
  GitLabPipeline,
  GitLabProject,
  GitLabResourceMilestoneEvent,
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
    projectId: number | string,
    state?: "opened" | "closed" | "all",
    options?: {
      updatedAfter?: string;
      maxPages?: number;
      /** Milestone title. Do not pass a numeric milestone ID here. */
      milestone?: string;
      /**
       * List-issues timebox filter only: Any | None | Upcoming | Started.
       * Mutually exclusive with `milestone`. Numeric IDs are invalid on list.
       */
      milestoneTimebox?: "Any" | "None" | "Upcoming" | "Started";
    },
  ): Promise<GitLabIssue[]>;
  listGroupIssues(
    groupId: string | number,
    options?: {
      state?: "opened" | "closed" | "all";
      milestone?: string;
      maxPages?: number;
    },
  ): Promise<GitLabIssue[]>;
  listProjectMergeRequests(projectId: number): Promise<GitLabMergeRequest[]>;
  getIssue(
    projectId: number | string,
    issueIid: number,
  ): Promise<GitLabIssue>;
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
    projectId: number | string,
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
  listProjectLabels(
    projectId: number | string,
    options?: GitLabPaginationOptions,
  ): Promise<GitLabLabel[]>;
  createProjectLabel(
    projectId: number | string,
    input: CreateGitLabLabelInput,
  ): Promise<GitLabLabel>;
  ensureProjectLabels(
    projectId: number | string,
    labels: EnsureGitLabLabelInput[],
    options?: EnsureLabelOptions,
  ): Promise<EnsureLabelsResult>;
  listIssueResourceMilestoneEvents(
    projectId: number | string,
    issueIid: number,
    options?: GitLabPaginationOptions,
  ): Promise<GitLabResourceMilestoneEvent[]>;
  updateIssueLabels(
    projectId: number | string,
    issueIid: number,
    mutation: GitLabIssueLabelMutation,
  ): Promise<GitLabIssue | null>;
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
