import {
  inferCategoryFromGroupId,
  lookupRepoFlowMapping,
} from "@/domain/releases/phoenix-repo-flow-map";
import type {
  ImpactMatrixChangedRepo,
  ImpactMatrixFlowRow,
  ImpactMatrixPreview,
  ImpactMatrixSummary,
  ImpactRisk,
  RegressionScope,
  TestAutomation,
} from "@/domain/types/impact-matrix";
import type {
  PhoenixReleasePlanGroupSection,
  PhoenixReleasePlanMode,
  PhoenixReleasePlanProjectRow,
} from "@/domain/types/phoenix-release-plan";

const RISK_ORDER: Record<ImpactRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const AUTOMATION_ORDER: Record<TestAutomation, number> = {
  automated: 0,
  mixed: 1,
  manual: 2,
};

export function isChangedDeployRow(row: PhoenixReleasePlanProjectRow): boolean {
  if (row.error || !row.deployVersion) return false;
  if (!row.rollbackVersion) return true;
  return row.deployVersion !== row.rollbackVersion;
}

export function maxRisk(risks: ImpactRisk[]): ImpactRisk {
  return risks.reduce<ImpactRisk>(
    (current, risk) => (RISK_ORDER[risk] > RISK_ORDER[current] ? risk : current),
    "low",
  );
}

export function mergeAutomation(values: TestAutomation[]): TestAutomation {
  return values.reduce<TestAutomation>(
    (current, value) =>
      AUTOMATION_ORDER[value] > AUTOMATION_ORDER[current] ? value : current,
    "automated",
  );
}

export function computeRegressionScope(
  risk: ImpactRisk,
  triggeredRepoCount: number,
): RegressionScope {
  if (risk === "high" || triggeredRepoCount >= 3) return "full";
  if (risk === "medium" || triggeredRepoCount >= 2) return "targeted";
  return "smoke";
}

export function computeRecommendedRegression(
  flowRows: ImpactMatrixFlowRow[],
): RegressionScope {
  if (flowRows.some((row) => row.regressionScope === "full")) return "full";
  if (flowRows.some((row) => row.regressionScope === "targeted")) {
    return "targeted";
  }
  return "smoke";
}

export function buildChangedRepos(
  sections: PhoenixReleasePlanGroupSection[],
): ImpactMatrixChangedRepo[] {
  const changed: ImpactMatrixChangedRepo[] = [];

  for (const section of sections) {
    if (section.error) continue;

    for (const row of section.rows) {
      if (!isChangedDeployRow(row) || !row.deployVersion) continue;

      const { mapping, mapped } = lookupRepoFlowMapping(row.projectName);
      const category =
        mapping.category === "platform"
          ? inferCategoryFromGroupId(section.groupId)
          : mapping.category;

      changed.push({
        groupId: section.groupId,
        projectName: row.projectName,
        projectWebUrl: row.projectWebUrl,
        deployVersion: row.deployVersion,
        rollbackVersion: row.rollbackVersion,
        compareUrl: row.compareUrl,
        category,
        flows: mapping.flows,
        risk: mapping.risk,
        testSuites: mapping.testSuites,
        automation: mapping.automation,
        mapped,
      });
    }
  }

  return changed.sort((left, right) =>
    left.projectName.localeCompare(right.projectName),
  );
}

export function buildFlowRows(
  changedRepos: ImpactMatrixChangedRepo[],
): ImpactMatrixFlowRow[] {
  const byFlow = new Map<
    string,
    {
      repos: Set<string>;
      risks: ImpactRisk[];
      suites: Set<string>;
      automations: TestAutomation[];
    }
  >();

  for (const repo of changedRepos) {
    for (const flow of repo.flows) {
      const bucket = byFlow.get(flow) ?? {
        repos: new Set<string>(),
        risks: [],
        suites: new Set<string>(),
        automations: [],
      };
      bucket.repos.add(repo.projectName);
      bucket.risks.push(repo.risk);
      for (const suite of repo.testSuites) bucket.suites.add(suite);
      bucket.automations.push(repo.automation);
      byFlow.set(flow, bucket);
    }
  }

  return [...byFlow.entries()]
    .map(([flow, bucket]) => {
      const risk = maxRisk(bucket.risks);
      const triggeredRepos = [...bucket.repos].sort();
      return {
        flow,
        triggeredRepos,
        risk,
        regressionScope: computeRegressionScope(risk, triggeredRepos.length),
        testSuites: [...bucket.suites].sort(),
        automation: mergeAutomation(bucket.automations),
      };
    })
    .sort((left, right) => {
      const riskDiff = RISK_ORDER[right.risk] - RISK_ORDER[left.risk];
      if (riskDiff !== 0) return riskDiff;
      return left.flow.localeCompare(right.flow);
    });
}

export function buildImpactMatrixSummary(options: {
  changedRepos: ImpactMatrixChangedRepo[];
  flowRows: ImpactMatrixFlowRow[];
}): ImpactMatrixSummary {
  return {
    changedRepoCount: options.changedRepos.length,
    mappedRepoCount: options.changedRepos.filter((repo) => repo.mapped).length,
    unmappedRepoCount: options.changedRepos.filter((repo) => !repo.mapped).length,
    flowCount: options.flowRows.length,
    highRiskFlowCount: options.flowRows.filter((row) => row.risk === "high").length,
    recommendedRegression: computeRecommendedRegression(options.flowRows),
  };
}

export function buildImpactMatrixTitle(
  mode: PhoenixReleasePlanMode,
  date = new Date(),
): string {
  const stamp = date.toISOString().slice(0, 10);
  return mode === "dev-qa"
    ? `DEV-QA Impact Matrix - ${stamp}`
    : `MAIN Impact Matrix - ${stamp}`;
}

export function buildImpactMatrixMarkdown(options: {
  mode: PhoenixReleasePlanMode;
  releasePlanTitle: string;
  changedRepos: ImpactMatrixChangedRepo[];
  flowRows: ImpactMatrixFlowRow[];
  summary: ImpactMatrixSummary;
}): string {
  const envLabel = options.mode === "dev-qa" ? "DEV-QA" : "MAIN";
  const lines = [
    `# ${envLabel} Impact Matrix`,
    "",
    `Generated from **${options.releasePlanTitle}**.`,
    "",
    "## Summary",
    "",
    `- Changed repos: **${options.summary.changedRepoCount}**`,
    `- Mapped repos: **${options.summary.mappedRepoCount}**`,
    `- Unmapped repos: **${options.summary.unmappedRepoCount}**`,
    `- Business flows impacted: **${options.summary.flowCount}**`,
    `- High-risk flows: **${options.summary.highRiskFlowCount}**`,
    `- Recommended regression: **${options.summary.recommendedRegression}**`,
    "",
    "## Changed services",
    "",
    "| Group | Project | Deploy | Rollback | Flows | Risk | Automation | Compare |",
    "|-------|---------|--------|----------|-------|------|------------|---------|",
  ];

  for (const repo of options.changedRepos) {
    lines.push(
      `| \`${repo.groupId}\` ` +
        `| ${repo.projectName}${repo.mapped ? "" : " (unmapped)"} ` +
        `| \`${repo.deployVersion}\` ` +
        `| ${repo.rollbackVersion ? `\`${repo.rollbackVersion}\`` : "-"} ` +
        `| ${repo.flows.join(", ")} ` +
        `| ${repo.risk} ` +
        `| ${repo.automation} ` +
        `| ${repo.compareUrl ? `[Compare](${repo.compareUrl})` : "-"} |`,
    );
  }

  lines.push("", "## Flow impact", "");
  lines.push(
    "| Business flow | Triggered repos | Risk | Regression | Test suites | Automation |",
  );
  lines.push(
    "|---------------|-----------------|------|------------|-------------|------------|",
  );

  for (const row of options.flowRows) {
    lines.push(
      `| ${row.flow} ` +
        `| ${row.triggeredRepos.join(", ")} ` +
        `| ${row.risk} ` +
        `| ${row.regressionScope} ` +
        `| ${row.testSuites.join(", ")} ` +
        `| ${row.automation} |`,
    );
  }

  lines.push("", "## Regression checklist", "");
  if (options.summary.recommendedRegression === "full") {
    lines.push("- [ ] Run full regression on all high-risk flows");
    lines.push("- [ ] Run targeted regression on medium-risk flows");
    lines.push("- [ ] Run smoke on low-risk flows");
  } else if (options.summary.recommendedRegression === "targeted") {
    lines.push("- [ ] Run targeted regression on impacted flows");
    lines.push("- [ ] Run smoke on unaffected critical paths");
  } else {
    lines.push("- [ ] Run smoke suite on changed services only");
  }

  lines.push("- [ ] Validate tenant setup in QA / pprd");
  lines.push("- [ ] Attach automation run results to release issue");

  return lines.join("\n").trim();
}

export function buildImpactMatrixPreview(options: {
  mode: PhoenixReleasePlanMode;
  releasePlanTitle: string;
  sections: PhoenixReleasePlanGroupSection[];
  generatedAt?: string;
  issueProjectId?: number | null;
}): ImpactMatrixPreview {
  const changedRepos = buildChangedRepos(options.sections);
  const flowRows = buildFlowRows(changedRepos);
  const summary = buildImpactMatrixSummary({ changedRepos, flowRows });
  const markdown = buildImpactMatrixMarkdown({
    mode: options.mode,
    releasePlanTitle: options.releasePlanTitle,
    changedRepos,
    flowRows,
    summary,
  });

  const issueProjectId = options.issueProjectId ?? null;

  return {
    mode: options.mode,
    title: buildImpactMatrixTitle(options.mode),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    markdown,
    changedRepos,
    flowRows,
    summary,
    releasePlanTitle: options.releasePlanTitle,
    issueProjectId,
    issueProjectConfigured: issueProjectId != null,
  };
}
