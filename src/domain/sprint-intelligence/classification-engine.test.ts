import { describe, expect, it } from "vitest";

import { evaluateSprintIssue } from "./classification-engine";
import {
  addEvent,
  config,
  ist,
  issue,
  kolkataEnd,
  kolkataStart,
  SPRINT,
} from "./test-helpers";

const ML = {
  planned: "sprint::planned",
  committed: "sprint::committed",
  spillover: "sprint::spillover",
  completedUnplanned: "sprint::completed-unplanned",
  unplanned: "unplanned",
};

function evaluate(
  issueInput: ReturnType<typeof issue>,
  cfg = config(),
  milestone = SPRINT,
) {
  return evaluateSprintIssue(issueInput, milestone, cfg, {
    evaluatedAt: new Date("2026-07-18T06:00:00.000Z"),
  });
}

describe("evaluateSprintIssue — planning boundary", () => {
  it("1. marks planned when assigned before sprint start", () => {
    const result = evaluate(
      issue({
        issueIid: 1,
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Planned");
    expect(result.reasonCodes).toContain("ASSIGNED_BEFORE_SPRINT_BOUNDARY");
    expect(result.labelsToAdd).toContain(ML.planned);
  });

  it("2. marks planned when assigned exactly at sprint start", () => {
    const result = evaluate(
      issue({
        issueIid: 2,
        milestoneEvents: [
          addEvent({
            id: 1,
            action: "add",
            createdAt: kolkataStart("2026-07-06").toISOString(),
          }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Planned");
  });

  it("3. marks planned during first day when first-day additions enabled", () => {
    const result = evaluate(
      issue({
        issueIid: 3,
        milestoneEvents: [
          addEvent({
            id: 1,
            action: "add",
            createdAt: ist("2026-07-06", "18:30:00.000"),
          }),
        ],
      }),
      config({ allowFirstDayAdditions: true }),
    );
    expect(result.planningStatus).toBe("Planned");
    expect(result.reasonCodes).toContain("ASSIGNED_DURING_ALLOWED_FIRST_DAY");
  });

  it("4. marks unplanned when assigned after sprint start (and after first day)", () => {
    const result = evaluate(
      issue({
        issueIid: 4,
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-08") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Unplanned");
    expect(result.reasonCodes).toContain("ASSIGNED_AFTER_SPRINT_BOUNDARY");
    expect(result.labelsToAdd).toContain(ML.unplanned);
    expect(result.labelsToAdd).not.toContain(ML.planned);
  });

  it("marks unplanned for first-day assignment when first-day additions disabled", () => {
    const result = evaluate(
      issue({
        issueIid: 34,
        milestoneEvents: [
          addEvent({
            id: 1,
            action: "add",
            createdAt: ist("2026-07-06", "18:30:00.000"),
          }),
        ],
      }),
      config({ allowFirstDayAdditions: false }),
    );
    expect(result.planningStatus).toBe("Unplanned");
  });
});

describe("evaluateSprintIssue — delivery / completion", () => {
  it("5. planned closed before sprint end → committed", () => {
    const result = evaluate(
      issue({
        issueIid: 5,
        state: "closed",
        closedAt: ist("2026-07-15"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("Committed");
    expect(result.reasonCodes).toContain("CLOSED_WITHIN_SPRINT");
    expect(result.labelsToAdd).toEqual(
      expect.arrayContaining([ML.planned, ML.committed]),
    );
    expect(result.labelsToAdd).not.toContain(ML.spillover);
  });

  it("6. planned closed exactly at sprint end → committed", () => {
    const result = evaluate(
      issue({
        issueIid: 6,
        state: "closed",
        closedAt: kolkataEnd("2026-07-17").toISOString(),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("Committed");
  });

  it("7. planned closed after sprint end → spillover", () => {
    const result = evaluate(
      issue({
        issueIid: 7,
        state: "closed",
        closedAt: ist("2026-07-18", "10:00:00.000"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("Spillover");
    expect(result.reasonCodes).toContain("CLOSED_AFTER_SPRINT");
    expect(result.labelsToAdd).toEqual(
      expect.arrayContaining([ML.planned, ML.spillover]),
    );
    expect(result.labelsToAdd).not.toContain(ML.committed);
  });

  it("8. planned still open after sprint end → spillover", () => {
    const result = evaluate(
      issue({
        issueIid: 8,
        state: "opened",
        closedAt: null,
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("Spillover");
    expect(result.reasonCodes).toContain("OPEN_AT_SPRINT_END");
  });

  it("9. unplanned completed within sprint → completed-unplanned", () => {
    const result = evaluate(
      issue({
        issueIid: 9,
        state: "closed",
        closedAt: ist("2026-07-16"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-10") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Unplanned");
    expect(result.deliveryStatus).toBe("CompletedUnplanned");
    expect(result.reasonCodes).toContain("COMPLETED_UNPLANNED");
    expect(result.labelsToAdd).toEqual(
      expect.arrayContaining([ML.unplanned, ML.completedUnplanned]),
    );
    expect(result.labelsToAdd).not.toContain(ML.committed);
  });

  it("10. unplanned still open → OpenUnplanned", () => {
    const result = evaluate(
      issue({
        issueIid: 10,
        state: "opened",
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-10") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("OpenUnplanned");
    expect(result.labelsToAdd).toEqual([ML.unplanned]);
  });
});

describe("evaluateSprintIssue — work types", () => {
  it("11. planned regression completed in sprint → planned + committed", () => {
    const result = evaluate(
      issue({
        issueIid: 11,
        state: "closed",
        closedAt: ist("2026-07-14"),
        labels: ["qa::regression"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.workTypes).toContain("regression");
    expect(result.planningStatus).toBe("Planned");
    expect(result.deliveryStatus).toBe("Committed");
  });

  it("12. regression added mid-sprint → unplanned", () => {
    const result = evaluate(
      issue({
        issueIid: 12,
        labels: ["qa::regression"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-12") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Unplanned");
    expect(result.labelsToAdd).toContain(ML.unplanned);
  });

  it("13. planned support completed within sprint but excluded from reliability", () => {
    const result = evaluate(
      issue({
        issueIid: 13,
        state: "closed",
        closedAt: ist("2026-07-14"),
        labels: ["Type::Support"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Planned");
    expect(result.deliveryStatus).toBe("Excluded");
    expect(result.excludedFromCommitment).toBe(true);
    expect(result.completedWithinSprint).toBe(true);
    expect(result.reasonCodes).toContain("EXCLUDED_SUPPORT");
    expect(result.labelsToAdd).toEqual([ML.planned]);
    expect(result.labelsToAdd).not.toContain(ML.committed);
    expect(result.labelsToAdd).not.toContain(ML.spillover);
  });

  it("planned support still open is Excluded, not Spillover", () => {
    const result = evaluate(
      issue({
        issueIid: 39,
        state: "opened",
        labels: ["Type::Support"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("Excluded");
    expect(result.completedWithinSprint).toBe(false);
    expect(result.labelsToAdd).toEqual([ML.planned]);
    expect(result.labelsToAdd).not.toContain(ML.spillover);
    expect(result.labelsToAdd).not.toContain(ML.committed);
  });

  it("planned UAT exclusion uses EXCLUDED_UAT reason code", () => {
    const result = evaluate(
      issue({
        issueIid: 40,
        state: "opened",
        labels: ["qa::uat"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
      config({ uatExcludedFromCommitment: true }),
    );
    expect(result.deliveryStatus).toBe("Excluded");
    expect(result.reasonCodes).toContain("EXCLUDED_UAT");
  });

  it("14. unplanned hotfix completed within sprint is excluded from commitment", () => {
    const result = evaluate(
      issue({
        issueIid: 14,
        state: "closed",
        closedAt: ist("2026-07-15"),
        labels: ["Type::Hotfix"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-12") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Unplanned");
    expect(result.deliveryStatus).toBe("CompletedUnplanned");
    expect(result.excludedFromCommitment).toBe(true);
    expect(result.reasonCodes).toContain("EXCLUDED_HOTFIX");
    expect(result.labelsToAdd).toEqual(
      expect.arrayContaining([ML.unplanned, ML.completedUnplanned]),
    );
    expect(result.labelsToAdd).not.toContain(ML.committed);
  });

  it("15. technical debt planned before sprint follows normal rules", () => {
    const result = evaluate(
      issue({
        issueIid: 15,
        state: "closed",
        closedAt: ist("2026-07-16"),
        labels: ["Type::Technical Debt"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-04") }),
        ],
      }),
    );
    expect(result.workTypes).toEqual(["tech_debt"]);
    expect(result.deliveryStatus).toBe("Committed");
    expect(result.excludedFromCommitment).toBe(false);
  });

  it("maps Type::Defect alias to bug work type", () => {
    const result = evaluate(
      issue({
        issueIid: 35,
        labels: ["Type::Defect"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.workTypes).toEqual(["bug"]);
  });

  it("keeps multiple work types including regression + defect", () => {
    const result = evaluate(
      issue({
        issueIid: 36,
        labels: ["Type::Defect", "qa::regression"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.workTypes).toEqual(["bug", "regression"]);
  });
});

describe("evaluateSprintIssue — milestone history", () => {
  it("16. removed and reassigned uses latest add cycle", () => {
    const result = evaluate(
      issue({
        issueIid: 16,
        state: "closed",
        closedAt: ist("2026-07-16"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-01") }),
          addEvent({ id: 2, action: "remove", createdAt: ist("2026-07-03") }),
          addEvent({ id: 3, action: "add", createdAt: ist("2026-07-10") }),
        ],
      }),
    );
    expect(result.reasonCodes).toContain("MILESTONE_REMOVED_AND_REASSIGNED");
    expect(result.planningStatus).toBe("Unplanned");
    expect(result.assignmentTimestamp?.toISOString()).toBe(
      new Date(ist("2026-07-10")).toISOString(),
    );
  });

  it("17. issue moved from another milestone — only target events count", () => {
    const result = evaluate(
      issue({
        issueIid: 17,
        milestoneEvents: [
          addEvent({
            id: 1,
            action: "add",
            createdAt: ist("2026-06-20"),
            milestoneId: 50,
          }),
          addEvent({
            id: 2,
            action: "remove",
            createdAt: ist("2026-07-05"),
            milestoneId: 50,
          }),
          addEvent({ id: 3, action: "add", createdAt: ist("2026-07-05", "09:00:00.000") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("Planned");
    expect(result.assignmentTimestamp?.toISOString()).toBe(
      new Date(ist("2026-07-05", "09:00:00.000")).toISOString(),
    );
  });

  it("18. missing milestone start date → UnableToDetermine", () => {
    const result = evaluate(
      issue({ issueIid: 18 }),
      config(),
      { ...SPRINT, startDate: null },
    );
    expect(result.planningStatus).toBe("UnableToDetermine");
    expect(result.deliveryStatus).toBe("UnableToDetermine");
    expect(result.reasonCodes).toContain("MILESTONE_DATES_MISSING");
    expect(result.labelsToAdd).toEqual([]);
  });

  it("19. missing milestone due date → UnableToDetermine", () => {
    const result = evaluate(
      issue({ issueIid: 19 }),
      config(),
      { ...SPRINT, dueDate: null },
    );
    expect(result.planningStatus).toBe("UnableToDetermine");
    expect(result.labelsToAdd).toEqual([]);
  });

  it("20. missing milestone event history → UnableToDetermine (no guessing)", () => {
    const result = evaluate(
      issue({
        issueIid: 20,
        createdAt: ist("2026-07-01"),
        milestoneEvents: null,
      }),
    );
    expect(result.planningStatus).toBe("UnableToDetermine");
    expect(result.deliveryStatus).toBe("UnableToDetermine");
    expect(result.reasonCodes).toContain("MILESTONE_HISTORY_UNAVAILABLE");
    expect(result.labelsToAdd).toEqual([]);
    expect(result.labelsToAdd).not.toContain(ML.planned);
  });

  it("does not classify removed issue as active unless audit history mode", () => {
    const result = evaluate(
      issue({
        issueIid: 37,
        currentMilestoneId: 200,
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
          addEvent({ id: 2, action: "remove", createdAt: ist("2026-07-09") }),
        ],
      }),
    );
    expect(result.planningStatus).toBe("NotApplicable");
    expect(result.labelsToAdd).toEqual([]);
  });
});

describe("evaluateSprintIssue — reopen and labels", () => {
  it("21. reopened issue is not committed", () => {
    const result = evaluate(
      issue({
        issueIid: 21,
        state: "opened",
        closedAt: ist("2026-07-14"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.reasonCodes).toContain("REOPENED_ISSUE");
    expect(result.deliveryStatus).toBe("Spillover");
    expect(result.labelsToAdd).not.toContain(ML.committed);
  });

  it("22. existing managed labels are corrected when invalid", () => {
    const result = evaluate(
      issue({
        issueIid: 22,
        state: "closed",
        closedAt: ist("2026-07-18", "12:00:00.000"),
        labels: [ML.planned, ML.committed, "Type::Defect"],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.deliveryStatus).toBe("Spillover");
    expect(result.labelsToAdd).toContain(ML.spillover);
    expect(result.managedLabelsToRemove).toContain(ML.committed);
    expect(result.managedLabelsToRemove).not.toContain("Type::Defect");
  });

  it("23. never plans duplicate labels", () => {
    const result = evaluate(
      issue({
        issueIid: 23,
        state: "closed",
        closedAt: ist("2026-07-14"),
        labels: [ML.planned, ML.committed],
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    expect(result.labelsToAdd).toEqual([]);
    expect(result.managedLabelsToRemove).toEqual([]);
  });

  it("does not emit contradictory committed + spillover labels", () => {
    const result = evaluate(
      issue({
        issueIid: 38,
        state: "closed",
        closedAt: ist("2026-07-18"),
        milestoneEvents: [
          addEvent({ id: 1, action: "add", createdAt: ist("2026-07-05") }),
        ],
      }),
    );
    const desired = [...result.labelsToAdd, ...result.existingLabels].filter(
      (label) =>
        label === ML.committed ||
        label === ML.spillover ||
        result.labelsToAdd.includes(label),
    );
    const planned = new Set([
      ...result.existingLabels.filter(
        (label) => !result.managedLabelsToRemove.includes(label),
      ),
      ...result.labelsToAdd,
    ]);
    expect(planned.has(ML.committed) && planned.has(ML.spillover)).toBe(false);
    expect(desired.includes(ML.committed) && desired.includes(ML.spillover)).toBe(
      false,
    );
  });
});
