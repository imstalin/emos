import { describe, expect, it } from "vitest";

import {
  endOfDayInTimeZone,
  startOfDayInTimeZone,
  zonedDateTimeToUtc,
} from "./timezone";

describe("timezone boundaries (Asia/Kolkata)", () => {
  it("27. maps calendar start/end to correct UTC instants (IST = UTC+5:30)", () => {
    const start = startOfDayInTimeZone("2026-07-06", "Asia/Kolkata");
    const end = endOfDayInTimeZone("2026-07-06", "Asia/Kolkata");

    expect(start?.toISOString()).toBe("2026-07-05T18:30:00.000Z");
    expect(end?.toISOString()).toBe("2026-07-06T18:29:59.999Z");
  });

  it("handles wall-clock conversion consistently across noon", () => {
    const noon = zonedDateTimeToUtc(2026, 7, 6, 12, 0, 0, 0, "Asia/Kolkata");
    expect(noon.toISOString()).toBe("2026-07-06T06:30:00.000Z");
  });
});
