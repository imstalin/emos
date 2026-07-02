import { describe, expect, it } from "vitest";

import {
  currentMonthKey,
  parseMonthlyReleaseEpicTitle,
} from "@/server/services/releases/release-epic.parser";

describe("parseMonthlyReleaseEpicTitle", () => {
  it("parses product release epics", () => {
    const parsed = parseMonthlyReleaseEpicTitle("June Product Release - 2026");
    expect(parsed).toEqual({
      monthKey: "2026-06",
      monthLabel: "June 2026",
      stream: "PRODUCT",
      year: 2026,
    });
  });

  it("parses observations and mobile streams", () => {
    expect(parseMonthlyReleaseEpicTitle("June Release Observations - 2026")?.stream).toBe(
      "OBSERVATIONS",
    );
    expect(parseMonthlyReleaseEpicTitle("June Product Release Mobile - 2026")?.stream).toBe(
      "MOBILE",
    );
  });

  it("returns null for unrelated epic titles", () => {
    expect(parseMonthlyReleaseEpicTitle("Test Automation")).toBeNull();
  });
});

describe("currentMonthKey", () => {
  it("formats month keys", () => {
    expect(currentMonthKey(new Date("2026-07-15"))).toBe("2026-07");
  });
});
