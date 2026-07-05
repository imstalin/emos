import type {
  PhoenixReleasePlanGroupSection,
  PhoenixReleasePlanMode,
  PhoenixReleasePlanPipelineInfo,
  PhoenixReleasePlanProjectRow,
} from "@/domain/types/phoenix-release-plan";

const DEFAULT_EXCLUDED = new Set([
  "coupon-generator",
  "catalog-sso",
  "briks",
  "self-registration-route",
  "self-registration",
  "loreal",
  "achievo",
  "alb",
  "app-deploy",
  "aurora",
  "aurora-prod",
  "bertembeddings",
  "beta-release",
  "bkt",
  "bkt-mobileapp",
  "cloudfront",
  "configs",
  "core-identity",
  "core-models",
  "core-tenant",
  "core-utils",
  "core-wrappers",
  "cumi-mobileapp",
  "cumi-webapp",
  "deploy-client",
  "developers",
  "devops",
  "docdb",
  "ec2",
  "ec2-prod",
  "eks",
  "eks-prod",
  "elasticache",
  "external-apis",
  "feature-requests",
  "gitlab",
  "gitlab-templates",   
  "helm-chart",
  "includes",
  "infra-monitoring",
  "ingress",
  "kong",
  "kong-ingress",
  "lamborghini",  
  "node-24",  
  "qa",         
  "rds",
  "release-management",
  "release-observations",
  "research",
  "s3", 
  "s3-prod",
  "security",       
  "securitygroups",
  "security-policy",
  "similaritysearch",
  "sqs",
  "sqs-prod",
  "test-automation",
  "tnpl",
  "tnpl-mobileapp",
  "toyota",
  "toyota-mobileapp",
  "tsc",
  "tsc-mobileapp",
  "tvs",
  "tvs-mobileapp",
  "tvs-webapp",
  "webdriverio",
  "work-packages",
  "wp-stories",
]);

export function getReleasePlanConfig(mode: PhoenixReleasePlanMode) {
  if (mode === "dev-qa") {
    return {
      branch: "development",
      tagPrefix: "qarelease-v",
      titleLabel: "DEV-QA Release Plan",
    };
  }

  return {
    branch: "main",
    tagPrefix: "v",
    titleLabel: "MAIN Release Plan",
  };
}

export function parseReleaseGroupIds(
  groupIdsRaw: string | undefined,
  fallbackGroupId: string | undefined,
): string[] {
  const fromList = (groupIdsRaw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (fromList.length > 0) return fromList;
  if (fallbackGroupId?.trim()) return [fallbackGroupId.trim()];
  return [];
}

export function parseExcludedProjectNames(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return DEFAULT_EXCLUDED;

  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function resolveBranchTags(options: {
  tags: Array<{ name: string; commit: { id: string } }>;
  branchCommitIds: Set<string>;
  tagPrefix: string;
}): Array<{ name: string; commit: { id: string } }> {
  return options.tags
    .filter((tag) => tag.name.startsWith(options.tagPrefix))
    .filter((tag) => options.branchCommitIds.has(tag.commit.id));
}

export function buildProjectRow(options: {
  projectName: string;
  projectWebUrl: string;
  branchTags: Array<{ name: string }>;
  deployPipeline?: PhoenixReleasePlanPipelineInfo | null;
  rollbackPipeline?: PhoenixReleasePlanPipelineInfo | null;
}): PhoenixReleasePlanProjectRow {
  const {
    projectName,
    projectWebUrl,
    branchTags,
    deployPipeline = null,
    rollbackPipeline = null,
  } = options;

  if (branchTags.length >= 2) {
    const latest = branchTags[0];
    const previous = branchTags[1];
    return {
      projectName,
      projectWebUrl,
      deployVersion: latest.name,
      deployPipelineUrl:
        deployPipeline?.webUrl ??
        `${projectWebUrl}/-/pipelines?scope=tags&ref=${encodeURIComponent(latest.name)}`,
      deployPipeline,
      rollbackVersion: previous.name,
      rollbackPipelineUrl:
        rollbackPipeline?.webUrl ??
        `${projectWebUrl}/-/pipelines?scope=tags&ref=${encodeURIComponent(previous.name)}`,
      rollbackPipeline,
      compareUrl: `${projectWebUrl}/-/compare/${encodeURIComponent(previous.name)}...${encodeURIComponent(latest.name)}`,
      error: null,
    };
  }

  if (branchTags.length === 1) {
    const tag = branchTags[0];
    return {
      projectName,
      projectWebUrl,
      deployVersion: tag.name,
      deployPipelineUrl:
        deployPipeline?.webUrl ??
        `${projectWebUrl}/-/pipelines?scope=tags&ref=${encodeURIComponent(tag.name)}`,
      deployPipeline,
      rollbackVersion: null,
      rollbackPipelineUrl: null,
      rollbackPipeline,
      compareUrl: null,
      error: null,
    };
  }

  return {
    projectName,
    projectWebUrl,
    deployVersion: null,
    deployPipelineUrl: null,
    deployPipeline: null,
    rollbackVersion: null,
    rollbackPipelineUrl: null,
    rollbackPipeline: null,
    compareUrl: null,
    error: null,
  };
}

export function getProblematicJobs(pipeline: PhoenixReleasePlanPipelineInfo | null) {
  if (!pipeline) return [];
  return pipeline.jobs.filter(
    (job) => job.status !== "success" && job.status !== "skipped",
  );
}

export function formatPipelineMarkdownCell(
  pipeline: PhoenixReleasePlanPipelineInfo | null,
  fallbackUrl: string | null,
): string {
  if (pipeline?.status) {
    const url = pipeline.webUrl ?? fallbackUrl;
    const problemJobs = getProblematicJobs(pipeline);
    const statusLabel = pipeline.status;

    if (url) {
      if (problemJobs.length > 0) {
        const jobSummary = problemJobs
          .map((job) => `${job.stage}/${job.name}:${job.status}`)
          .join(", ");
        return `[${statusLabel}](${url}) (${jobSummary})`;
      }
      return `[${statusLabel}](${url})`;
    }

    if (problemJobs.length > 0) {
      const jobSummary = problemJobs
        .map((job) => `${job.stage}/${job.name}:${job.status}`)
        .join(", ");
      return `${statusLabel} (${jobSummary})`;
    }

    return statusLabel;
  }

  if (fallbackUrl) return `[Link](${fallbackUrl})`;
  return "-";
}

export function buildReleasePlanMarkdown(
  mode: PhoenixReleasePlanMode,
  sections: PhoenixReleasePlanGroupSection[],
): string {
  const { titleLabel } = getReleasePlanConfig(mode);
  const lines = [`# ${titleLabel}`, ""];

  for (const section of sections) {
    if (section.error) {
      lines.push(`## Failed to fetch group \`${section.groupId}\``, "", section.error, "");
      continue;
    }

    lines.push(`## \`${section.groupId}\`${section.groupName ? ` (${section.groupName})` : ""}`, "");
    lines.push(
      "| Project | Deploy Version | Pipeline | Rollback Version | Pipeline | Compare |",
    );
    lines.push(
      "|---------|----------------|----------|------------------|----------|---------|",
    );

    for (const row of section.rows) {
      if (row.error) {
        lines.push(
          `| ${row.projectName} | Error: ${row.error} | - | - | - | - |`,
        );
        continue;
      }

      lines.push(
        `| ${row.projectName} ` +
          `| ${row.deployVersion ? `\`${row.deployVersion}\`` : "-"} ` +
          `| ${formatPipelineMarkdownCell(row.deployPipeline, row.deployPipelineUrl)} ` +
          `| ${row.rollbackVersion ? `\`${row.rollbackVersion}\`` : "-"} ` +
          `| ${formatPipelineMarkdownCell(row.rollbackPipeline, row.rollbackPipelineUrl)} ` +
          `| ${row.compareUrl ? `[Compare](${row.compareUrl})` : "-"} |`,
      );
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

export function buildIssueTitle(mode: PhoenixReleasePlanMode, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return mode === "dev-qa"
    ? `DEV-QA Release Plan - ${stamp}`
    : `MAIN Release Plan - ${stamp}`;
}
