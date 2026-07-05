export interface FiscalYearSprint {
  number: number;
  title: string;
  startDate: string;
  dueDate: string;
}

export interface FiscalYearSprintPlan {
  fiscalYearLabel: string;
  startDate: string;
  endDate: string;
  sprintLengthDays: number;
  sprints: FiscalYearSprint[];
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthYear(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}-${year}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function findLastFridayOnOrBefore(date: Date): Date {
  const cursor = new Date(date);
  while (cursor.getUTCDay() !== 5) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return cursor;
}

function formatMonthAbbr(date: Date): string {
  const labels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return labels[date.getUTCMonth()] ?? "???";
}

export type PhoenixSprintTitleFormat = "month_sprint_number" | "sprint_number_month_year";

export type PhoenixSprintCadence = "calendar_days" | "biweekly_friday";

const BIWEEKLY_FRIDAY_SPRINT_DAYS = 12; // Mon week 1 through Fri week 2 (inclusive)

export function buildPhoenixBiweeklyFridaySprintPlan(options: {
  startDate: string;
  endDate: string;
  startingSprintNumber?: number;
}): FiscalYearSprintPlan {
  const startingSprintNumber = options.startingSprintNumber ?? 1;
  const fiscalStart = parseUtcDate(options.startDate);
  const fiscalEnd = parseUtcDate(options.endDate);
  const sprints: FiscalYearSprint[] = [];

  let cursor = fiscalStart;
  let sprintNumber = startingSprintNumber;

  while (cursor <= fiscalEnd) {
    const sprintStart = cursor;
    const idealEnd = addDays(sprintStart, BIWEEKLY_FRIDAY_SPRINT_DAYS - 1);

    if (idealEnd > fiscalEnd) {
      const lastFriday = findLastFridayOnOrBefore(fiscalEnd);
      const daysRemaining =
        Math.floor((lastFriday.getTime() - sprintStart.getTime()) / 86_400_000) + 1;

      if (daysRemaining >= 5 && lastFriday >= sprintStart) {
        sprints.push({
          number: sprintNumber,
          title: `${formatMonthAbbr(lastFriday)} - Sprint ${sprintNumber}`,
          startDate: formatDate(sprintStart),
          dueDate: formatDate(lastFriday),
        });
      }
      break;
    }

    sprints.push({
      number: sprintNumber,
      title: `${formatMonthAbbr(idealEnd)} - Sprint ${sprintNumber}`,
      startDate: formatDate(sprintStart),
      dueDate: formatDate(idealEnd),
    });

    sprintNumber += 1;
    cursor = addDays(idealEnd, 3); // next Monday after Friday
  }

  const startYear = fiscalStart.getUTCFullYear();
  const endYear = fiscalEnd.getUTCFullYear();

  return {
    fiscalYearLabel: `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
    startDate: options.startDate,
    endDate: options.endDate,
    sprintLengthDays: BIWEEKLY_FRIDAY_SPRINT_DAYS,
    sprints,
  };
}

export function buildPhoenixGroupSprintPlan(options: {
  startDate: string;
  endDate: string;
  sprintLengthDays?: number;
  startingSprintNumber?: number;
  titleFormat?: PhoenixSprintTitleFormat;
  cadence?: PhoenixSprintCadence;
}): FiscalYearSprintPlan {
  if (options.cadence === "biweekly_friday") {
    return buildPhoenixBiweeklyFridaySprintPlan({
      startDate: options.startDate,
      endDate: options.endDate,
      startingSprintNumber: options.startingSprintNumber,
    });
  }

  const sprintLengthDays = options.sprintLengthDays ?? 14;
  const startingSprintNumber = options.startingSprintNumber ?? 1;
  const titleFormat = options.titleFormat ?? "month_sprint_number";

  const fiscalStart = parseUtcDate(options.startDate);
  const fiscalEnd = parseUtcDate(options.endDate);
  const sprints: FiscalYearSprint[] = [];

  let cursor = fiscalStart;
  let sprintNumber = startingSprintNumber;

  while (cursor <= fiscalEnd) {
    const sprintStart = cursor;
    const idealEnd = addDays(sprintStart, sprintLengthDays - 1);

    if (idealEnd >= fiscalEnd) {
      const daysRemaining =
        Math.floor((fiscalEnd.getTime() - sprintStart.getTime()) / 86_400_000) + 1;

      if (daysRemaining < 7 && sprints.length > 0) {
        const last = sprints[sprints.length - 1];
        sprints[sprints.length - 1] = {
          ...last,
          dueDate: formatDate(fiscalEnd),
          title:
            titleFormat === "month_sprint_number"
              ? `${formatMonthAbbr(fiscalEnd)} - Sprint ${last.number}`
              : `Sprint ${last.number} (${formatMonthYear(fiscalEnd)})`,
        };
        break;
      }

      const dueDate = fiscalEnd;
      sprints.push({
        number: sprintNumber,
        title:
          titleFormat === "month_sprint_number"
            ? `${formatMonthAbbr(dueDate)} - Sprint ${sprintNumber}`
            : `Sprint ${sprintNumber} (${formatMonthYear(dueDate)})`,
        startDate: formatDate(sprintStart),
        dueDate: formatDate(dueDate),
      });
      break;
    }

    sprints.push({
      number: sprintNumber,
      title:
        titleFormat === "month_sprint_number"
          ? `${formatMonthAbbr(idealEnd)} - Sprint ${sprintNumber}`
          : `Sprint ${sprintNumber} (${formatMonthYear(idealEnd)})`,
      startDate: formatDate(sprintStart),
      dueDate: formatDate(idealEnd),
    });

    sprintNumber += 1;
    cursor = addDays(idealEnd, 1);
  }

  const startYear = fiscalStart.getUTCFullYear();
  const endYear = fiscalEnd.getUTCFullYear();

  return {
    fiscalYearLabel: `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
    startDate: options.startDate,
    endDate: options.endDate,
    sprintLengthDays,
    sprints,
  };
}

export function buildFiscalYearSprintPlan(options: {
  startDate: string;
  endDate: string;
  sprintLengthDays?: number;
  startingSprintNumber?: number;
  titlePrefix?: string;
}): FiscalYearSprintPlan {
  const sprintLengthDays = options.sprintLengthDays ?? 14;
  const startingSprintNumber = options.startingSprintNumber ?? 1;
  const titlePrefix = options.titlePrefix ?? "Sprint";

  const fiscalStart = parseUtcDate(options.startDate);
  const fiscalEnd = parseUtcDate(options.endDate);
  const sprints: FiscalYearSprint[] = [];

  let cursor = fiscalStart;
  let sprintNumber = startingSprintNumber;

  while (cursor <= fiscalEnd) {
    const sprintStart = cursor;
    const idealEnd = addDays(sprintStart, sprintLengthDays - 1);

    if (idealEnd >= fiscalEnd) {
      const daysRemaining =
        Math.floor((fiscalEnd.getTime() - sprintStart.getTime()) / 86_400_000) + 1;

      if (daysRemaining < 7 && sprints.length > 0) {
        sprints[sprints.length - 1] = {
          ...sprints[sprints.length - 1],
          dueDate: formatDate(fiscalEnd),
        };
        break;
      }

      sprints.push({
        number: sprintNumber,
        title: `${titlePrefix} ${sprintNumber} (${formatMonthYear(fiscalEnd)})`,
        startDate: formatDate(sprintStart),
        dueDate: formatDate(fiscalEnd),
      });
      break;
    }

    sprints.push({
      number: sprintNumber,
      title: `${titlePrefix} ${sprintNumber} (${formatMonthYear(idealEnd)})`,
      startDate: formatDate(sprintStart),
      dueDate: formatDate(idealEnd),
    });

    sprintNumber += 1;
    cursor = addDays(idealEnd, 1);
  }

  const startYear = fiscalStart.getUTCFullYear();
  const endYear = fiscalEnd.getUTCFullYear();

  return {
    fiscalYearLabel: `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
    startDate: options.startDate,
    endDate: options.endDate,
    sprintLengthDays,
    sprints,
  };
}

export const DEFAULT_FY_26_27 = buildFiscalYearSprintPlan({
  startDate: "2026-07-26",
  endDate: "2027-06-27",
});
