import { describe, expect, it } from "vitest";

import {
  buildProjectRow,
  buildReleasePlanMarkdown,
  formatPipelineMarkdownCell,
  resolveBranchTags,
} from "@/domain/releases/phoenix-release-plan.builder";

describe("phoenix-release-plan.builder", () => {
  it("filters tags on branch commits by prefix", () => {
    const tags = resolveBranchTags({
      tags: [
        { name: "v1.2.0", commit: { id: "a" } },
        { name: "v1.1.0", commit: { id: "b" } },
        { name: "qarelease-v1.0.0", commit: { id: "a" } },
      ],
      branchCommitIds: new Set(["a", "b"]),
      tagPrefix: "v",
    });

    expect(tags.map((tag) => tag.name)).toEqual(["v1.2.0", "v1.1.0"]);
  });

  it("builds deploy and rollback row", () => {
    const row = buildProjectRow({
      projectName: "admin",
      projectWebUrl: "https://gitlab.example.com/phoenix/admin",
      branchTags: [{ name: "v2.0.0" }, { name: "v1.9.0" }],
    });

    expect(row.deployVersion).toBe("v2.0.0");
    expect(row.rollbackVersion).toBe("v1.9.0");
    expect(row.compareUrl).toContain("v1.9.0...v2.0.0");
  });

  it("renders markdown table", () => {
    const markdown = buildReleasePlanMarkdown("main", [
      {
        groupId: "phoenix",
        groupName: "Phoenix",
        error: null,
        rows: [
          buildProjectRow({
            projectName: "admin",
            projectWebUrl: "https://gitlab.example.com/phoenix/admin",
            branchTags: [{ name: "v2.0.0" }, { name: "v1.9.0" }],
            deployPipeline: {
              status: "success",
              webUrl: "https://gitlab.example.com/phoenix/admin/-/pipelines/1",
              jobs: [],
            },
            rollbackPipeline: {
              status: "failed",
              webUrl: "https://gitlab.example.com/phoenix/admin/-/pipelines/2",
              jobs: [
                {
                  name: "deploy",
                  stage: "deploy",
                  status: "failed",
                  webUrl: "https://gitlab.example.com/phoenix/admin/-/jobs/3",
                },
              ],
            },
          }),
        ],
      },
    ]);

    expect(markdown).toContain("# MAIN Release Plan");
    expect(markdown).toContain("| admin |");
    expect(markdown).toContain("`v2.0.0`");
    expect(markdown).toContain("[success]");
    expect(markdown).toContain("[failed]");
    expect(markdown).toContain("deploy/deploy:failed");
  });

  it("formats pipeline markdown with job failures", () => {
    expect(
      formatPipelineMarkdownCell(
        {
          status: "failed",
          webUrl: "https://gitlab.example.com/pipelines/1",
          jobs: [
            {
              name: "test",
              stage: "test",
              status: "failed",
              webUrl: "https://gitlab.example.com/jobs/1",
            },
          ],
        },
        null,
      ),
    ).toContain("test/test:failed");
  });
});
