import { describe, expect, it } from "vitest";

import {
  getMonitoredGitLabProjectIds,
  isMonitoredGitLabProject,
} from "@/lib/gitlab-config";

describe("monitored GitLab projects", () => {
  it("parses GITLAB_PROJECT_IDS from environment", () => {
    const original = process.env.GITLAB_PROJECT_IDS;
    process.env.GITLAB_PROJECT_IDS = "6100,8232";

    expect(getMonitoredGitLabProjectIds()).toEqual([6100, 8232]);
    expect(isMonitoredGitLabProject(6100)).toBe(true);
    expect(isMonitoredGitLabProject(9999)).toBe(false);

    process.env.GITLAB_PROJECT_IDS = original;
  });

  it("allows all projects when GITLAB_PROJECT_IDS is unset", () => {
    const original = process.env.GITLAB_PROJECT_IDS;
    delete process.env.GITLAB_PROJECT_IDS;

    expect(getMonitoredGitLabProjectIds()).toBeNull();
    expect(isMonitoredGitLabProject(9999)).toBe(true);

    process.env.GITLAB_PROJECT_IDS = original;
  });
});
