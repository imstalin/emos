import { afterEach, describe, expect, it } from "vitest";

import {
  getSprintIntelligenceEnvConfig,
  resolveEffectiveSprintIntelligenceConfig,
} from "./sprint-intelligence-config";

describe("sprint-intelligence-config", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("defaults to disabled, dry-run-only, discovery off, auto-apply off", () => {
    delete process.env.SPRINT_INTELLIGENCE_ENABLED;
    delete process.env.SPRINT_INTELLIGENCE_DRY_RUN_ONLY;
    delete process.env.SPRINT_INTELLIGENCE_DISCOVERY_ENABLED;
    delete process.env.SPRINT_INTELLIGENCE_AUTO_APPLY;

    const config = getSprintIntelligenceEnvConfig();
    expect(config.enabled).toBe(false);
    expect(config.dryRunOnly).toBe(true);
    expect(config.discoveryEnabled).toBe(false);
    expect(config.autoApply).toBe(false);
    expect(config.createMissingLabels).toBe(false);
  });

  it("project override wins over env for selected fields", () => {
    process.env.SPRINT_INTELLIGENCE_ENABLED = "true";
    const effective = resolveEffectiveSprintIntelligenceConfig({
      projectId: 1,
      enabled: false,
      timezone: "UTC",
      allowFirstDayAdditions: false,
    });
    expect(effective.enabled).toBe(false);
    expect(effective.ruleConfig.timezone).toBe("UTC");
    expect(effective.ruleConfig.allowFirstDayAdditions).toBe(false);
  });
});
