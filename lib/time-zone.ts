/**
 * The report date pickers hand over calendar dates ("2026-08-09"), but `createdAt`
 * is stored as a UTC instant. Turning those dates into UTC boundaries naively
 * (`new Date("2026-08-09T00:00:00.000Z")`) silently shifts the window by the shop's
 * UTC offset, so in Asia/Karachi (UTC+5) a "today" filter dropped every sale made
 * before 5am and pulled in the next morning's sales instead. Everything here works
 * in the shop timezone so the boundaries land on real local midnights.
 */

const FALLBACK_TIME_ZONE = "Asia/Karachi";

export const APP_TIME_ZONE =
  process.env.NEXT_PUBLIC_APP_TIME_ZONE?.trim() ||
  process.env.APP_TIME_ZONE?.trim() ||
  FALLBACK_TIME_ZONE;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Milliseconds to add to a UTC instant to get the wall-clock reading in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const wallClock: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      wallClock[part.type] = Number(part.value);
    }
  }

  const asUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );

  return asUtc - instant.getTime();
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value.trim());
}

/** The UTC instant at which the given calendar day starts in `timeZone`. */
export function startOfZonedDay(isoDate: string, timeZone: string = APP_TIME_ZONE): Date | null {
  const match = ISO_DATE_PATTERN.exec(isoDate.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const wallClockAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(wallClockAsUtc)) {
    return null;
  }

  // The offset depends on the instant we are asking about, so guess once with the
  // naive value and refine — this is what keeps DST transition days correct.
  const guess = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  const refined = wallClockAsUtc - zoneOffsetMs(new Date(guess), timeZone);

  return new Date(refined);
}

export function addDaysToIsoDate(isoDate: string, days: number): string | null {
  const match = ISO_DATE_PATTERN.exec(isoDate.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days));
  if (Number.isNaN(shifted.getTime())) {
    return null;
  }

  return shifted.toISOString().slice(0, 10);
}

/** Exclusive upper bound: the UTC instant at which the day *after* `isoDate` starts. */
export function endOfZonedDayExclusive(
  isoDate: string,
  timeZone: string = APP_TIME_ZONE,
): Date | null {
  const nextDay = addDaysToIsoDate(isoDate, 1);
  return nextDay ? startOfZonedDay(nextDay, timeZone) : null;
}

/** The calendar date (YYYY-MM-DD) that `instant` falls on in `timeZone`. */
export function isoDateInZone(instant: Date, timeZone: string = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD, which is exactly what <input type="date"> wants.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
