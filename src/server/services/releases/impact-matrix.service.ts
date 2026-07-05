import { buildImpactMatrixPreview } from "@/domain/releases/impact-matrix.builder";
import type {
  ImpactMatrixIssueResult,
  ImpactMatrixPreview,
} from "@/domain/types/impact-matrix";
import type { PhoenixReleasePlanMode } from "@/domain/types/phoenix-release-plan";
import {
  getGitLabConfig,
  getReleaseIssueProjectId,
} from "@/lib/gitlab-config";
import { createGitLabProvider } from "@/server/providers/gitlab/gitlab-api.provider";
import { phoenixReleasePlanService } from "@/server/services/releases/phoenix-release-plan.service";

export class ImpactMatrixService {
  async preview(mode: PhoenixReleasePlanMode): Promise<ImpactMatrixPreview> {
    const releasePlan = await phoenixReleasePlanService.preview(mode);
    const issueProjectId = getReleaseIssueProjectId();

    return buildImpactMatrixPreview({
      mode,
      releasePlanTitle: releasePlan.title,
      sections: releasePlan.sections,
      generatedAt: releasePlan.generatedAt,
      issueProjectId,
    });
  }

  async createIssue(options: {
    mode: PhoenixReleasePlanMode;
    confirm: true;
  }): Promise<ImpactMatrixIssueResult> {
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
}

export const impactMatrixService = new ImpactMatrixService();
