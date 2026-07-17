import { describe, expect, it } from "vitest";

import { mapPool } from "./map-pool";

describe("mapPool", () => {
  it("preserves order and respects concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapPool([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return value * 10;
    });
    expect(results).toEqual([10, 20, 30, 40]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
