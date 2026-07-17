import { describe, expect, it } from "vitest";

import {
  isExcludedFromCommitment,
  resolveWorkTypes,
} from "./work-type-resolver";
import { config } from "./test-helpers";

describe("resolveWorkTypes", () => {
  it("maps Type:: aliases to canonical work types", () => {
    expect(
      resolveWorkTypes(
        ["Type::Defect", "priority::high"],
        config(),
      ),
    ).toEqual(["bug"]);

    expect(resolveWorkTypes(["Type::Enhancement"], config())).toEqual([
      "enhancement",
    ]);
    expect(resolveWorkTypes(["Type::Technical Debt"], config())).toEqual([
      "tech_debt",
    ]);
    expect(resolveWorkTypes(["Type::Support"], config())).toEqual(["support"]);
    expect(resolveWorkTypes(["Type::Hotfix"], config())).toEqual(["hotfix"]);
  });

  it("maps automation work:: and qa:: labels", () => {
    expect(resolveWorkTypes(["work::bug", "qa::regression"], config())).toEqual(
      ["bug", "regression"],
    );
    expect(resolveWorkTypes(["qa::testing"], config())).toEqual([
      "functional_testing",
    ]);
    expect(resolveWorkTypes(["qa::uat"], config())).toEqual(["uat"]);
  });

  it("supports multiple work-type labels", () => {
    const types = resolveWorkTypes(
      ["Type::Defect", "qa::regression", "release::validation"],
      config(),
    );
    expect(types).toEqual(["bug", "regression", "release_validation"]);
  });

  it("returns other when no aliases match", () => {
    expect(resolveWorkTypes(["Status::In Progress"], config())).toEqual([
      "other",
    ]);
  });
});

describe("isExcludedFromCommitment", () => {
  it("excludes support and hotfix by default", () => {
    expect(
      isExcludedFromCommitment(["support"], config()).excluded,
    ).toBe(true);
    expect(
      isExcludedFromCommitment(["hotfix"], config()).reasons,
    ).toContain("EXCLUDED_HOTFIX");
  });

  it("respects exclusion configuration", () => {
    expect(
      isExcludedFromCommitment(
        ["support"],
        config({ supportExcludedFromCommitment: false }),
      ).excluded,
    ).toBe(false);
  });

  it("emits EXCLUDED_UAT when UAT exclusion is enabled", () => {
    const result = isExcludedFromCommitment(
      ["uat"],
      config({ uatExcludedFromCommitment: true }),
    );
    expect(result.excluded).toBe(true);
    expect(result.reasons).toContain("EXCLUDED_UAT");
  });
});
