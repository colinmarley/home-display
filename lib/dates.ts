// Timezone-aware date helpers. Everything on the display is computed in the
// configured display timezone (settings.tz), never the host's local zone — the
// container and the Pi have both been UTC at various points.

export const DEFAULT_TZ = "America/Los_Angeles";

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of `date` as seen in `tz`. */
export function dayKey(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function keyToUTC(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDaysKey(key: string, n: number): string {
  const d = keyToUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

/** 0 = Sunday … 6 = Saturday for a calendar date (timezone-free). */
export function weekdayOfKey(key: string): number {
  return keyToUTC(key).getUTCDay();
}

export function startOfWeekKey(key: string, weekStartsOn = 1): string {
  const diff = (weekdayOfKey(key) - weekStartsOn + 7) % 7;
  return addDaysKey(key, -diff);
}

export function keyParts(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function diffDaysKey(a: string, b: string): number {
  return Math.round((keyToUTC(a).getTime() - keyToUTC(b).getTime()) / 86_400_000);
}

/** Offset (ms) of `tz` from UTC at instant `date`. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant of wall-clock `hh:mm` on calendar day `key` in `tz`. */
export function zonedTime(key: string, tz: string, hour = 0, minute = 0): Date {
  const { year, month, day } = keyParts(key);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle DST transitions.
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz);
  return new Date(t);
}

export function startOfDay(key: string, tz: string): Date {
  return zonedTime(key, tz, 0, 0);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function monthName(month: number, short = false): string {
  const n = MONTHS[month - 1];
  return short ? n.slice(0, 3) : n;
}

export function weekdayName(weekday: number, short = false): string {
  return short ? WEEKDAYS[weekday] : WEEKDAY_LONG[weekday];
}

/** "Sunday, October 11" */
export function longDateLabel(key: string): string {
  const { month, day } = keyParts(key);
  return `${weekdayName(weekdayOfKey(key))}, ${monthName(month)} ${day}`;
}

/** "3p", "3:30p" (compact) or "3 PM", "3:30 PM". */
export function formatTime(date: Date | string, tz: string, compact = false): string {
  const p = zonedParts(typeof date === "string" ? new Date(date) : date, tz);
  const h12 = p.hour % 12 || 12;
  const mm = p.minute === 0 ? "" : `:${pad(p.minute)}`;
  if (compact) return `${h12}${mm}${p.hour >= 12 ? "p" : "a"}`;
  return `${h12}${mm} ${p.hour >= 12 ? "PM" : "AM"}`;
}

/** Minutes since local midnight in `tz`. */
export function minutesOfDay(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  return p.hour * 60 + p.minute;
}

/** Parse "HH:MM" → minutes since midnight. */
export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Is `now` (minutes since midnight) within [start, end), wrapping past midnight. */
export function inWindow(now: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
