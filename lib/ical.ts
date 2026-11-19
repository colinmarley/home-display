import ICAL from "ical.js";

// Expand an iCalendar document into concrete occurrences within a window.
// Handles RRULE/RDATE/EXDATE, RECURRENCE-ID overrides (moved/edited
// instances), STATUS:CANCELLED and embedded VTIMEZONEs. node-ical, which this
// replaces, only returned each series' first instance.

export interface Occurrence {
  uid: string;
  title: string;
  location?: string;
  allDay: boolean;
  /** All-day: YYYY-MM-DD. Timed: ISO instant. */
  start: string;
  /** All-day: YYYY-MM-DD (exclusive). Timed: ISO instant. */
  end: string;
}

const MAX_ITERATIONS = 20_000;

const pad = (n: number) => String(n).padStart(2, "0");

function dateKey(t: ICAL.Time): string {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

function registerTimezones(root: ICAL.Component): void {
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const tzid = tz.getFirstPropertyValue("tzid");
    if (typeof tzid === "string" && !ICAL.TimezoneService.has(tzid)) {
      ICAL.TimezoneService.register(new ICAL.Timezone(tz));
    }
  }
}

function toOccurrence(
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time | null
): Occurrence | null {
  const status = item.component.getFirstPropertyValue("status");
  if (typeof status === "string" && status.toUpperCase() === "CANCELLED") return null;

  const allDay = start.isDate;
  let startStr: string;
  let endStr: string;
  if (allDay) {
    startStr = dateKey(start);
    const e = end ?? start.clone();
    if (!end || e.compare(start) <= 0) {
      const next = start.clone();
      next.day += 1;
      endStr = dateKey(next);
    } else {
      endStr = dateKey(e);
    }
  } else {
    const s = start.toJSDate();
    const e = end ? end.toJSDate() : s;
    startStr = s.toISOString();
    endStr = (e < s ? s : e).toISOString();
  }

  return {
    uid: item.uid,
    title: item.summary || "(no title)",
    location: item.location || undefined,
    allDay,
    start: startStr,
    end: endStr,
  };
}

function overlaps(o: Occurrence, rangeStart: Date, rangeEnd: Date, rangeStartKey: string, rangeEndKey: string) {
  if (o.allDay) return o.start < rangeEndKey && o.end > rangeStartKey;
  return new Date(o.start) < rangeEnd && new Date(o.end) > rangeStart;
}

/**
 * @param rangeStartKey / rangeEndKey  YYYY-MM-DD bounds used for all-day events
 *   (compared as calendar dates, no timezone shift).
 */
export function expandIcs(
  ics: string,
  rangeStart: Date,
  rangeEnd: Date,
  rangeStartKey: string,
  rangeEndKey: string
): Occurrence[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  registerTimezones(root);

  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const orphans: ICAL.Component[] = [];

  for (const v of vevents) {
    if (v.hasProperty("recurrence-id")) continue;
    const ev = new ICAL.Event(v);
    // Duplicate UIDs happen in merged feeds — keep the first.
    if (!masters.has(ev.uid)) masters.set(ev.uid, ev);
  }
  for (const v of vevents) {
    if (!v.hasProperty("recurrence-id")) continue;
    const uid = v.getFirstPropertyValue("uid");
    const master = typeof uid === "string" ? masters.get(uid) : undefined;
    if (master) master.relateException(v);
    else orphans.push(v);
  }

  const out: Occurrence[] = [];
  const push = (o: Occurrence | null) => {
    if (o && overlaps(o, rangeStart, rangeEnd, rangeStartKey, rangeEndKey)) out.push(o);
  };

  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      push(toOccurrence(ev, ev.startDate, ev.endDate));
      continue;
    }
    const it = ev.iterator();
    let n = 0;
    for (let next = it.next(); next; next = it.next()) {
      if (++n > MAX_ITERATIONS) break;
      // All-day occurrences compare by date key; timed by instant.
      if (next.isDate ? dateKey(next) >= rangeEndKey : next.toJSDate() >= rangeEnd) break;
      const d = ev.getOccurrenceDetails(next);
      push(toOccurrence(d.item, d.startDate, d.endDate));
    }
  }

  // An override whose series wasn't in this document (CalDAV can return them
  // separately) is still a real event on its own.
  for (const v of orphans) {
    const ev = new ICAL.Event(v);
    if (ev.startDate) push(toOccurrence(ev, ev.startDate, ev.endDate));
  }

  return out;
}
