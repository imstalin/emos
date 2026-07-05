import {
  buildIssueTitle,
  buildProjectRow,
  buildReleasePlanMarkdown,
  getReleasePlanConfig,
  parseExcludedProjectNames,
  resolveBranchTags,
} from "@/domain/releases/phoenix-release-plan.builder";
import type {
  PhoenixReleasePlanIssueResult,
  PhoenixReleasePlanMode,
  PhoenixReleasePlanPipelineInfo,
  PhoenixReleasePlanPreview,
  PhoenixReleasePlanProjectRow,
} from "@/domain/types/phoenix-release-plan";
import {
  getGitLabConfig,
  getReleaseGroupIds,
  getReleaseIssueProjectId,
} from "@/lib/gitlab-config";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import type { GitLabProvider } from "@/server/providers/gitlab/gitlab-provider";

async function fetchTagPipelineInfo(
  provider: GitLabProvider,
  projectId: number,
  tagName: string | null,
): Promise<PhoenixReleasePlanPipelineInfo | null> {
  if (!tagName) return null;

  try {
    const pipelines = await provider.listProjectPipelines(projectId, tagName, 1);
    const pipeline = pipelines[0];
    if (!pipeline) {
      return { status: null, webUrl: null, jobs: [] };
    }

    const jobs = await provider.listPipelineJobs(projectId, pipeline.id);
    return {
      status: pipeline.status,
      webUrl: pipeline.web_url,
      jobs: jobs.map((job) => ({
        name: job.name,
        stage: job.stage,
        status: job.status,
        webUrl: job.web_url,
      })),
    };
  } catch {
    return null;
  }
}

async function enrichProjectRowWithPipelines(
  provider: GitLabProvider,
  projectId: number,
  row: PhoenixReleasePlanProjectRow,
): Promise<PhoenixReleasePlanProjectRow> {
  if (row.error) return row;

  const [deployPipeline, rollbackPipeline] = await Promise.all([
    fetchTagPipelineInfo(provider, projectId, row.deployVersion),
    fetchTagPipelineInfo(provider, projectId, row.rollbackVersion),
  ]);

  return buildProjectRow({
    projectName: row.projectName,
    projectWebUrl: row.projectWebUrl,
    branchTags: [
      ...(row.deployVersion ? [{ name: row.deployVersion }] : []),
      ...(row.rollbackVersion ? [{ name: row.rollbackVersion }] : []),
    ],
    deployPipeline,
    rollbackPipeline,
  });
}

export class PhoenixReleasePlanService {
  async preview(mode: PhoenixReleasePlanMode): Promise<PhoenixReleasePlanPreview> {
    const sections = await this.buildSections(mode);
    const markdown = buildReleasePlanMarkdown(mode, sections);
    const issueProjectId = getReleaseIssueProjectId();

    return {
      mode,
      title: buildIssueTitle(mode),
      generatedAt: new Date().toISOString(),
      markdown,
      sections,
      issueProjectId,
      issueProjectConfigured: issueProjectId != null,
    };
  }

  async createIssue(options: {
    mode: PhoenixReleasePlanMode;
    confirm: true;
  }): Promise<PhoenixReleasePlanIssueResult> {
    if (!options.confirm) {
      throw new Error("Issue creation requires explicit confirmation");
    }

    const issueProjectId = getReleaseIssueProjectId();
    if (!issueProjectId) {
      throw new Error("GITLAB_RELEASE_ISSUE_PROJECT_ID is not configured");
    }

    const preview = await this.preview(options.mode);
    const config = getGitLabConfig();
    if (!config) {
      throw new Error("GitLab is not configured");
    }

    const provider = createGitLabProvider(config);
    const issue = await provider.createProjectIssue(issueProjectId, {
      title: preview.title,
      description: preview.markdown,
    });

    return {
      issueIid: issue.iid,
      issueWebUrl: issue.web_url,
      title: preview.title,
    };
  }

  private async buildSections(mode: PhoenixReleasePlanMode) {
    const config = getGitLabConfig();
    if (!config) {
      throw new Error("GitLab is not configured");
    }

    const groupIds = getReleaseGroupIds();
    if (groupIds.length === 0) {
      throw new Error("No GitLab release groups configured");
    }

    const provider = createGitLabProvider(config);
    const planConfig = getReleasePlanConfig(mode);
    const excluded = parseExcludedProjectNames(
      process.env.GITLAB_RELEASE_EXCLUDED_PROJECTS,
    );

    const sections = [];

    for (const groupId of groupIds) {
      try {
        let groupName: string | null = null;
        try {
          const group = await provider.getGroup(groupId);
          groupName = group.name;
        } catch {
          groupName = null;
        }

        const projects = await provider.listGroupProjectsByGroup(groupId);
        const rows = [];

        for (const project of projects) {
          if (excluded.has(project.name.toLowerCase())) continue;

          try {
            const fullProject = await provider.getProject(project.id);
            const branch = planConfig.branch;
            const [tags, commits] = await Promise.all([
              provider.listProjectTags(project.id),
              provider.listProjectCommits(project.id, branch, 1),
            ]);

            const branchCommitIds = new Set(commits.map((commit) => commit.id));
            const branchTags = resolveBranchTags({
              tags,
              branchCommitIds,
              tagPrefix: planConfig.tagPrefix,
            });

            rows.push(
              await enrichProjectRowWithPipelines(
                provider,
                project.id,
                buildProjectRow({
                  projectName: project.name,
                  projectWebUrl: fullProject.web_url,
                  branchTags,
                }),
              ),
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Failed to load project";
            rows.push({
              projectName: project.name,
              projectWebUrl: project.web_url,
              deployVersion: null,
              deployPipelineUrl: null,
              deployPipeline: null,
              rollbackVersion: null,
              rollbackPipelineUrl: null,
              rollbackPipeline: null,
              compareUrl: null,
              error: message,
            });
          }
        }

        sections.push({
          groupId,
          groupName,
          rows,
          error: null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch group";
        sections.push({
          groupId,
          groupName: null,
          rows: [],
          error: message,
        });
      }
    }

    return sections;
  }
}

export const phoenixReleasePlanService = new PhoenixReleasePlanService();
