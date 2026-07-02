import { describe, expect, it } from "vitest";

import { ROADMAP_SHEET_FY27_V1 } from "@/domain/types/roadmap";
import {
  loadFy27V1ItemsFromWorkbook,
  parseFy27V1Sheet,
} from "@/server/services/roadmap/roadmap-xlsx";

describe("roadmap-xlsx", () => {
  it("loads FY27 V1 items from the planning workbook", async () => {
    const items = await loadFy27V1ItemsFromWorkbook();

    expect(items.length).toBeGreaterThan(100);
    expect(items[0]?.title).toBeTruthy();
    expect(items[0]?.assignee).toBeTruthy();
  });

  it("maps Core, Mob, and Data flags from sheet values", () => {
    const items = parseFy27V1Sheet({
      name: ROADMAP_SHEET_FY27_V1,
      headers: [
        "Priority",
        "Include",
        "Project",
        "Category",
        "Quarter",
        "Timeline",
        "Assignee",
        "Hours",
        "Core",
        "Mob",
        "Data",
        "Title",
        "Description",
      ],
      rows: [
        [
          "High",
          "Yes",
          "CS 2.0 Core",
          "New Feature",
          "Q1",
          "Jan-Mar",
          "MJ",
          40,
          "Y",
          "Y",
          null,
          "Sample item",
          "Sample description",
        ],
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      priority: "High",
      include: "Yes",
      assignee: "MJ",
      timeline: "Jan-Mar",
      core: true,
      mobile: true,
      data: false,
      hours: 40,
    });
  });
});
