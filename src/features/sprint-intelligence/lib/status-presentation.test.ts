import { describe, expect, it } from "vitest";

import {
  formatPercent,
  shortRunId,
  TRIGGER_LABELS,
} from "./status-presentation";

describe("status presentation helpers", () => {
  it("shortens run ids", () => {
    expect(shortRunId("abcdefghijklmnop")).toBe("abcdefgh…");
    expect(shortRunId("short")).toBe("short");
  });

  it("formats percentages and zero denominators as em dash", () => {
    expect(formatPercent(50)).toBe("50%");
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
  });

  it("labels scheduled triggers for history", () => {
    expect(TRIGGER_LABELS.SPRINT_END).toBe("Sprint End");
    expect(TRIGGER_LABELS.POST_SPRINT_RECONCILIATION).toBe(
      "Post-Sprint Reconciliation",
    );
  });
});
