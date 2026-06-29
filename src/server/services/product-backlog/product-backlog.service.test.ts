import { describe, expect, it } from "vitest";

import { getDemoProductBacklogData } from "@/server/services/product-backlog/product-backlog-demo-data";

describe("getDemoProductBacklogData", () => {
  it("returns tasks and defects partitions", () => {
    const data = getDemoProductBacklogData();

    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.defects.length).toBeGreaterThan(0);
    expect(data.summary.total).toBe(data.tasks.length + data.defects.length);
  });
});
