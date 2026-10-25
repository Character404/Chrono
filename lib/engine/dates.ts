/**
 * Date-only helpers. All dates are ISO strings "YYYY-MM-DD" with no time
 * component, interpreted as South African business days.
 * Arithmetic is done in UTC so there are no daylight-saving surprises.
 */
export type ISODate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !ISO_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function assertISODate(value: string, field = "date"): void {
  if (!isISODate(value)) throw new Error(`Invalid ${field}: "${value}" (expected YYYY-MM-DD)`);
}

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

/** Whole days from b to a (a minus b). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function dateParts(date: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/** Builds a date, clamping the day to the month's last day (31 Nov becomes 30 Nov). */
export function makeDateClamped(year: number, month: number, day: number): ISODate {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  const d = Math.min(day, daysInMonth(y, m));
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today's date in South Africa, regardless of the server's time zone. */
export function todayInJohannesburg(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats a date as "Tue 12 Nov". */
export function formatShortDate(date: ISODate): string {
  const dt = new Date(toUTC(date));
  return `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Monday the 2nd of November", for speech. */
export function spokenDate(date: ISODate): string {
  const dt = new Date(toUTC(date));
  const d = dt.getUTCDate();
  const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${WEEKDAYS_LONG[dt.getUTCDay()]} the ${d}${suffix} of ${MONTHS_LONG[dt.getUTCMonth()]}`;
}

/** "the 26th", for speech. */
export function spokenDay(date: ISODate): string {
  const d = new Date(toUTC(date)).getUTCDate();
  const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `the ${d}${suffix}`;
}
