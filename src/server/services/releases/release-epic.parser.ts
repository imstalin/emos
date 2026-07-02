import type { ReleaseStream } from "@prisma/client";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTHLY_RELEASE_PATTERN =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(Product Release Mobile|Release Observations|Product Release)\s+-\s+(\d{4})$/i;

export interface ParsedMonthlyReleaseEpic {
  monthKey: string;
  monthLabel: string;
  stream: ReleaseStream;
  year: number;
}

export function parseMonthlyReleaseEpicTitle(
  title: string,
): ParsedMonthlyReleaseEpic | null {
  const match = title.trim().match(MONTHLY_RELEASE_PATTERN);
  if (!match) return null;

  const [, monthName, streamLabel, yearText] = match;
  const monthIndex = MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === monthName.toLowerCase(),
  );
  if (monthIndex < 0) return null;

  const year = Number(yearText);
  const month = String(monthIndex + 1).padStart(2, "0");

  return {
    monthKey: `${year}-${month}`,
    monthLabel: `${monthName} ${year}`,
    stream: mapStreamLabel(streamLabel),
    year,
  };
}

function mapStreamLabel(label: string): ReleaseStream {
  const normalized = label.toLowerCase();
  if (normalized.includes("mobile")) return "MOBILE";
  if (normalized.includes("observations")) return "OBSERVATIONS";
  return "PRODUCT";
}

export function formatMonthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11 || !year) return monthKey;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export function currentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function streamSortOrder(stream: ReleaseStream): number {
  switch (stream) {
    case "PRODUCT":
      return 0;
    case "OBSERVATIONS":
      return 1;
    case "MOBILE":
      return 2;
  }
}
