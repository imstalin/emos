import { describe, expect, it } from "vitest";

import { resolveSprintBoundaries } from "./sprint-boundary";
import { config, kolkataEnd, kolkataStart, SPRINT } from "./test-helpers";

describe("resolveSprintBoundaries", () => {
  it("uses start-of-day and end-of-day in Asia/Kolkata", () => {
    const result = resolveSprintBoundaries(SPRINT, config());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.boundaries.sprintStart).toEqual(kolkataStart("2026-07-06"));
    expect(result.boundaries.sprintEnd).toEqual(kolkataEnd("2026-07-17"));
  });

  it("sets planning boundary to end of first day when allowFirstDayAdditions=true", () => {
    const result = resolveSprintBoundaries(
      SPRINT,
      config({ allowFirstDayAdditions: true }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.boundaries.planningBoundary).toEqual(
      kolkataEnd("2026-07-06"),
    );
  });

  it("sets planning boundary to sprint start when allowFirstDayAdditions=false", () => {
    const result = resolveSprintBoundaries(
      SPRINT,
      config({ allowFirstDayAdditions: false }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.boundaries.planningBoundary).toEqual(
      kolkataStart("2026-07-06"),
    );
  });

  it("fails when start date is missing", () => {
    const result = resolveSprintBoundaries(
      { ...SPRINT, startDate: null },
      config(),
    );
    expect(result).toEqual({ ok: false, reason: "missing_start" });
  });

  it("fails when due date is missing", () => {
    const result = resolveSprintBoundaries(
      { ...SPRINT, dueDate: null },
      config(),
    );
    expect(result).toEqual({ ok: false, reason: "missing_due" });
  });
});
