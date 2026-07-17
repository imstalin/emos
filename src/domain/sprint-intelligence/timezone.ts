/**
 * Timezone helpers using Intl (no extra dependencies).
 * Suitable for Asia/Kolkata and other IANA zones, including DST where applicable.
 */

const DATE_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarDate(
  dateYmd: string,
): { year: number; month: number; day: number } | null {
  const match = DATE_YMD.exec(dateYmd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}

function getTimeZoneOffsetMs(timeZone: string, utcDate: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcDate);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value);
  };

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return asUtc - utcDate.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  const offset1 = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  let utcMs = utcGuess - offset1;
  const offset2 = getTimeZoneOffsetMs(timeZone, new Date(utcMs));
  if (offset2 !== offset1) {
    utcMs = utcGuess - offset2;
  }
  return new Date(utcMs);
}

export function startOfDayInTimeZone(
  dateYmd: string,
  timeZone: string,
): Date | null {
  const parsed = parseCalendarDate(dateYmd);
  if (!parsed) return null;
  return zonedDateTimeToUtc(
    parsed.year,
    parsed.month,
    parsed.day,
    0,
    0,
    0,
    0,
    timeZone,
  );
}

export function endOfDayInTimeZone(
  dateYmd: string,
  timeZone: string,
): Date | null {
  const parsed = parseCalendarDate(dateYmd);
  if (!parsed) return null;

  // Prefer start-of-next-day - 1ms. formatToParts has second precision only,
  // so converting 23:59:59.999 directly can drift.
  const nextUtc = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1),
  );
  const nextYmd = [
    nextUtc.getUTCFullYear(),
    String(nextUtc.getUTCMonth() + 1).padStart(2, "0"),
    String(nextUtc.getUTCDate()).padStart(2, "0"),
  ].join("-");

  const nextStart = startOfDayInTimeZone(nextYmd, timeZone);
  if (!nextStart) return null;
  return new Date(nextStart.getTime() - 1);
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}
