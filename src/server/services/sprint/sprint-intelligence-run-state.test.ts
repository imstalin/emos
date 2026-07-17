import { describe, expect, it } from "vitest";

import {
  assertSprintRunTransition,
  canTransitionSprintRunStatus,
  isSuccessfulAnalysisStatus,
  isTerminalSprintRunStatus,
} from "./sprint-intelligence-run-state";

describe("sprint run state transitions", () => {
  it("allows valid transitions", () => {
    expect(canTransitionSprintRunStatus("PENDING", "QUEUED")).toBe(true);
    expect(canTransitionSprintRunStatus("QUEUED", "RUNNING")).toBe(true);
    expect(canTransitionSprintRunStatus("RUNNING", "COMPLETED")).toBe(true);
    expect(canTransitionSprintRunStatus("RUNNING", "PARTIAL")).toBe(true);
    expect(canTransitionSprintRunStatus("RUNNING", "FAILED")).toBe(true);
    expect(canTransitionSprintRunStatus("RUNNING", "REJECTED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionSprintRunStatus("COMPLETED", "RUNNING")).toBe(false);
    expect(canTransitionSprintRunStatus("FAILED", "QUEUED")).toBe(false);
    expect(() => assertSprintRunTransition("COMPLETED", "FAILED")).toThrow(
      /INVALID_RUN_TRANSITION/,
    );
  });

  it("identifies terminal and successful statuses", () => {
    expect(isTerminalSprintRunStatus("COMPLETED")).toBe(true);
    expect(isTerminalSprintRunStatus("RUNNING")).toBe(false);
    expect(isSuccessfulAnalysisStatus("PARTIAL")).toBe(true);
    expect(isSuccessfulAnalysisStatus("FAILED")).toBe(false);
  });
});
