import { describe, expect, it } from "vitest";

import {
  buildChangedRepos,
  buildFlowRows,
  buildImpactMatrixMarkdown,
  buildImpactMatrixPreview,
  computeRegressionScope,
  isChangedDeployRow,
} from "@/domain/releases/impact-matrix.builder";
import { buildProjectRow } from "@/domain/releases/phoenix-release-plan.builder";

describe("impact-matrix.builder", () => {
  it("detects changed deploy rows", () => {
    expect(
      isChangedDeployRow({
        projectName: "admin",
        projectWebUrl: "https://example.com/admin",
        deployVersion: "v2.0.0",
        deployPipelineUrl: null,
        deployPipeline: null,
        rollbackVersion: "v1.9.0",
        rollbackPipelineUrl: null,
        rollbackPipeline: null,
        compareUrl: null,
        error: null,
      }),
    ).toBe(true);

    expect(
      isChangedDeployRow({
        projectName: "admin",
        projectWebUrl: "https://example.com/admin",
        deployVersion: "v2.0.0",
        deployPipelineUrl: null,
        deployPipeline: null,
        rollbackVersion: "v2.0.0",
        rollbackPipelineUrl: null,
        rollbackPipeline: null,
        compareUrl: null,
        error: null,
      }),
    ).toBe(false);
  });

  it("maps changed repos to business flows", () => {
    const changedRepos = buildChangedRepos([
      {
        groupId: "phoenix/services",
        groupName: "services",
        error: null,
        rows: [
          buildProjectRow({
            projectName: "identity",
            projectWebUrl: "https://example.com/identity",
            branchTags: [{ name: "v1.0.20" }, { name: "v1.0.19" }],
          }),
          buildProjectRow({
            projectName: "logging",
            projectWebUrl: "https://example.com/logging",
            branchTags: [{ name: "v1.0.3" }, { name: "v1.0.3" }],
          }),
        ],
      },
    ]);

    expect(changedRepos).toHaveLength(1);
    expect(changedRepos[0]?.projectName).toBe("identity");
    expect(changedRepos[0]?.flows).toContain("Authentication & SSO");
    expect(changedRepos[0]?.mapped).toBe(true);
  });

  it("rolls up flow rows with regression scope", () => {
    const flowRows = buildFlowRows([
      {
        groupId: "phoenix/services",
        projectName: "identity",
        projectWebUrl: "https://example.com/identity",
        deployVersion: "v1.0.20",
        rollbackVersion: "v1.0.19",
        compareUrl: null,
        category: "services",
        flows: ["Authentication & SSO", "Tenant management"],
        risk: "high",
        testSuites: ["AUTH-SUITE"],
        automation: "automated",
        mapped: true,
      },
      {
        groupId: "phoenix/experiences/frontend",
        projectName: "webapp",
        projectWebUrl: "https://example.com/webapp",
        deployVersion: "v0.0.26",
        rollbackVersion: "v0.0.25",
        compareUrl: null,
        category: "frontend",
        flows: ["Authentication & SSO", "Learner experience"],
        risk: "high",
        testSuites: ["WEBAPP-E2E"],
        automation: "automated",
        mapped: true,
      },
    ]);

    const authFlow = flowRows.find((row) => row.flow === "Authentication & SSO");
    expect(authFlow?.triggeredRepos).toEqual(["identity", "webapp"]);
    expect(authFlow?.regressionScope).toBe("full");
    expect(computeRegressionScope("medium", 1)).toBe("targeted");
  });

  it("renders markdown impact matrix", () => {
    const preview = buildImpactMatrixPreview({
      mode: "main",
      releasePlanTitle: "MAIN Release Plan - 2026-07-05",
      sections: [
        {
          groupId: "phoenix/services",
          groupName: "services",
          error: null,
          rows: [
            buildProjectRow({
              projectName: "identity",
              projectWebUrl: "https://example.com/identity",
              branchTags: [{ name: "v1.0.20" }, { name: "v1.0.19" }],
            }),
          ],
        },
      ],
    });

    expect(preview.title).toBe("MAIN Impact Matrix - 2026-07-05");
    expect(preview.summary.changedRepoCount).toBe(1);
    expect(preview.summary.recommendedRegression).toBe("full");

    const markdown = buildImpactMatrixMarkdown({
      mode: "main",
      releasePlanTitle: preview.releasePlanTitle,
      changedRepos: preview.changedRepos,
      flowRows: preview.flowRows,
      summary: preview.summary,
    });

    expect(markdown).toContain("# MAIN Impact Matrix");
    expect(markdown).toContain("Authentication & SSO");
    expect(markdown).toContain("| identity |");
  });
});
