import { createDAVClient, type DAVCalendar } from "tsdav";
import { expandIcs, type Occurrence } from "../ical";
import { addDaysKey, dayKey, startOfDay } from "../dates";
import type { CalEvent, CalendarInfo, CalendarPayload, CalendarSourceStatus } from "../types";

// Calendar sources:
//   GOOGLE_ICAL_URL[_*]     Google "secret address in iCal format" feeds
//   ICLOUD_USERNAME + ICLOUD_APP_PASSWORD   iCloud over CalDAV (all calendars)
//   APPLE_ICAL_URL[_*] / ICAL_URL[_*]       any other published .ics feed
// Each source keeps its previous events when it fails, so one flaky feed
// (iCloud's published links 503 regularly) never blanks the display.

const WINDOW_PAST_DAYS = 14;
const WINDOW_FUTURE_DAYS = 120;
const FETCH_TIMEOUT_MS = 30_000;

const GOOGLE_COLOR = "#4285f4";
const APPLE_COLOR = "#fc3158";
const PALETTE = ["#4285f4", "#fc3158", "#34a853", "#f9ab00", "#a142f4", "#00acc1", "#ff7043", "#9e9d24"];

interface Window {
  startKey: string;
  endKey: string;
  start: Date;
  end: Date;
}

interface SourceResult {
  key: string;
  calendars: CalendarInfo[];
  events: CalEvent[];
  /** Opaque change tokens per calendar (CalDAV ctag). */
  tokens?: Record<string, string>;
}

interface SourceDef {
  key: string;
  run: (win: Window, prev: SourceResult | undefined) => Promise<SourceResult>;
}

/** Stored alongside the public payload so the next run can reuse unchanged data. */
export interface CalendarInternal extends CalendarPayload {
  bySource: Record<string, SourceResult>;
}

function envEntries(prefix: string): [string, string][] {
  return Object.entries(process.env)
    .filter(([k, v]) => (k === prefix || k.startsWith(`${prefix}_`)) && !!v && v.trim().length > 0)
    .sort(([a], [b]) => a.localeCompare(b)) as [string, string][];
}

function normalizeUrl(url: string): string {
  const t = url.trim().replace(/^['"]|['"]$/g, "");
  return t.startsWith("webcal://") ? `https://${t.slice("webcal://".length)}` : t;
}

function toEvents(occ: Occurrence[], cal: CalendarInfo): CalEvent[] {
  return occ.map((o) => ({
    id: `${cal.id}|${o.uid}|${o.start}`,
    title: o.title,
    location: o.location,
    calendarId: cal.id,
    calendarName: cal.name,
    color: cal.color,
    allDay: o.allDay,
    start: o.start,
    end: o.end,
  }));
}

function calNameFromIcs(ics: string): string | null {
  const m = ics.match(/^X-WR-CALNAME:(.+)$/m);
  return m ? m[1].trim() : null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "HomeDisplay/2.0" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("response is not an iCalendar feed");
  return text;
}

function icsSource(envKey: string, url: string, kind: "google" | "ics", color: string): SourceDef {
  return {
    key: envKey,
    run: async (win) => {
      const ics = await fetchText(normalizeUrl(url));
      const cal: CalendarInfo = {
        id: envKey,
        name: calNameFromIcs(ics) ?? (kind === "google" ? "Google" : "Calendar"),
        color,
        source: kind,
      };
      const occ = expandIcs(ics, win.start, win.end, win.startKey, win.endKey);
      return { key: envKey, calendars: [cal], events: toEvents(occ, cal) };
    },
  };
}

function normalizeColor(c: unknown, fallback: string): string {
  if (typeof c !== "string") return fallback;
  const m = c.trim().match(/^#([0-9a-f]{6})/i);
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

function icloudSource(username: string, password: string): SourceDef {
  return {
    key: "icloud",
    run: async (win, prev) => {
      const client = await createDAVClient({
        serverUrl: "https://caldav.icloud.com",
        credentials: { username, password },
        authMethod: "Basic",
        defaultAccountType: "caldav",
      });
      const davCals = (await client.fetchCalendars()).filter((c: DAVCalendar) =>
        (c.components ?? ["VEVENT"]).includes("VEVENT")
      );

      const calendars: CalendarInfo[] = [];
      const events: CalEvent[] = [];
      const tokens: Record<string, string> = {};
      const sameWindow =
        prev?.tokens?.__window === `${win.startKey}..${win.endKey}`;

      for (const [i, c] of davCals.entries()) {
        const id = `icloud:${c.url}`;
        const name = typeof c.displayName === "string" ? c.displayName : "iCloud";
        const cal: CalendarInfo = {
          id,
          name,
          color: normalizeColor(c.calendarColor, PALETTE[(i + 1) % PALETTE.length] ?? APPLE_COLOR),
          source: "icloud",
        };
        calendars.push(cal);
        const ctag = c.ctag ?? c.syncToken ?? "";
        if (ctag) tokens[id] = String(ctag);

        // Unchanged calendar + same window → reuse the previous expansion.
        if (sameWindow && ctag && prev?.tokens?.[id] === String(ctag)) {
          events.push(...prev.events.filter((e) => e.calendarId === id).map((e) => ({ ...e, color: cal.color, calendarName: name })));
          continue;
        }

        const objects = await client.fetchCalendarObjects({
          calendar: c,
          timeRange: { start: win.start.toISOString(), end: win.end.toISOString() },
        });
        for (const o of objects) {
          if (typeof o.data !== "string" || !o.data.includes("BEGIN:VEVENT")) continue;
          try {
            events.push(...toEvents(expandIcs(o.data, win.start, win.end, win.startKey, win.endKey), cal));
          } catch (err) {
            console.warn(`[calendar] skipped unparsable object ${o.url}: ${String(err)}`);
          }
        }
      }
      tokens.__window = `${win.startKey}..${win.endKey}`;
      return { key: "icloud", calendars, events, tokens };
    },
  };
}

export function configuredSources(): SourceDef[] {
  const sources: SourceDef[] = [];
  for (const [k, url] of envEntries("GOOGLE_ICAL_URL")) sources.push(icsSource(k, url, "google", GOOGLE_COLOR));
  const user = process.env.ICLOUD_USERNAME?.trim();
  const pass = process.env.ICLOUD_APP_PASSWORD?.trim();
  if (user && pass) sources.push(icloudSource(user, pass));
  else for (const [k, url] of envEntries("APPLE_ICAL_URL")) sources.push(icsSource(k, url, "ics", APPLE_COLOR));
  for (const [k, url] of envEntries("ICAL_URL")) sources.push(icsSource(k, url, "ics", PALETTE[sources.length % PALETTE.length]));
  return sources;
}

export function calendarWindow(now: Date, tz: string): Window {
  const today = dayKey(now, tz);
  const startKey = addDaysKey(today, -WINDOW_PAST_DAYS);
  const endKey = addDaysKey(today, WINDOW_FUTURE_DAYS);
  return { startKey, endKey, start: startOfDay(startKey, tz), end: startOfDay(endKey, tz) };
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.name === "TimeoutError" ? "timed out" : e.message;
  return String(e);
}

/**
 * Run every source; a failed source falls back to its previous result.
 * Throws only when nothing at all could be produced.
 */
export async function syncCalendar(
  tz: string,
  prev: CalendarInternal | null,
  sources = configuredSources(),
  now = new Date()
): Promise<{ payload: CalendarInternal; warning: string | null }> {
  if (sources.length === 0) throw new Error("no calendar sources configured");
  const win = calendarWindow(now, tz);
  const settled = await Promise.allSettled(sources.map((s) => s.run(win, prev?.bySource[s.key])));

  const bySource: Record<string, SourceResult> = {};
  const statuses: CalendarSourceStatus[] = [];
  const failures: string[] = [];
  const prevStatus = new Map((prev?.sources ?? []).map((s) => [s.key, s]));

  settled.forEach((r, i) => {
    const key = sources[i].key;
    if (r.status === "fulfilled") {
      bySource[key] = r.value;
      statuses.push({ key, ok: true, syncedAt: now.getTime(), eventCount: r.value.events.length });
      return;
    }
    const msg = errMsg(r.reason);
    failures.push(`${key}: ${msg}`);
    const old = prev?.bySource[key];
    if (old) bySource[key] = old;
    statuses.push({
      key,
      ok: false,
      error: msg,
      syncedAt: prevStatus.get(key)?.syncedAt,
      eventCount: old?.events.length ?? 0,
    });
  });

  if (Object.keys(bySource).length === 0) throw new Error(failures.join("; "));

  const results = Object.values(bySource);
  const payload: CalendarInternal = {
    windowStart: win.startKey,
    windowEnd: win.endKey,
    calendars: results.flatMap((r) => r.calendars),
    events: results.flatMap((r) => r.events),
    sources: statuses,
    bySource,
  };
  return { payload, warning: failures.length ? failures.join("; ") : null };
}

/** Public view: strips the per-source cache and applies hidden/color overrides. */
export function publicCalendar(
  p: CalendarInternal | null,
  overrides: Record<string, { hidden?: boolean; color?: string }>
): CalendarPayload | null {
  if (!p) return null;
  const color = (id: string, fallback: string) => overrides[id]?.color || fallback;
  return {
    windowStart: p.windowStart,
    windowEnd: p.windowEnd,
    calendars: p.calendars.map((c) => ({ ...c, color: color(c.id, c.color) })),
    events: p.events
      .filter((e) => !overrides[e.calendarId]?.hidden)
      .map((e) => ({ ...e, color: color(e.calendarId, e.color) })),
    sources: p.sources,
  };
}
