import { addDaysKey, dayKey, keyParts, startOfDay } from "./dates";
import type { CalEvent, Countdown, Settings, SpecialDate } from "./types";

// Day bucketing for events, in the display timezone. All-day events compare as
// plain dates (end exclusive); timed events by instant against local midnights.

export function occursOn(e: CalEvent, key: string, tz: string): boolean {
  if (e.allDay) return e.start <= key && e.end > key;
  const dayStart = startOfDay(key, tz).getTime();
  const dayEnd = startOfDay(addDaysKey(key, 1), tz).getTime();
  const s = new Date(e.start).getTime();
  const en = Math.max(new Date(e.end).getTime(), s + 1);
  return s < dayEnd && en > dayStart;
}

export function sortEvents(events: CalEvent[]): CalEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function eventsOn(events: CalEvent[], key: string, tz: string): CalEvent[] {
  return sortEvents(events.filter((e) => occursOn(e, key, tz)));
}

/** True when a timed event started on an earlier day (render as "continues"). */
export function startsBefore(e: CalEvent, key: string, tz: string): boolean {
  return e.allDay ? e.start < key : dayKey(new Date(e.start), tz) < key;
}

export function specialDateOn(key: string, settings: Settings): SpecialDate | undefined {
  const { month, day } = keyParts(key);
  return settings.specialDates.find((s) => s.month === month && s.day === day);
}

export function upcomingCountdowns(settings: Settings, today: string): Countdown[] {
  return settings.countdowns.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

/** "in 25 min", "in 2 h", "now". */
export function relativeStart(e: CalEvent, now: Date): string {
  const mins = Math.round((new Date(e.start).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m && h < 3 ? `in ${h} h ${m} min` : `in ${h} h`;
}
