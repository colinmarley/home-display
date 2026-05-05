import ical from "node-ical";

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string; // ISO string
  allDay: boolean;
  color: string;
  source: "google" | "apple";
}

export async function getCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<CalEvent[]> {
  const sources: { url: string; source: "google" | "apple"; color: string }[] =
    [];

  if (process.env.GOOGLE_ICAL_URL)
    sources.push({
      url: process.env.GOOGLE_ICAL_URL,
      source: "google",
      color: "#4285f4",
    });

  if (process.env.APPLE_ICAL_URL)
    sources.push({
      url: process.env.APPLE_ICAL_URL,
      source: "apple",
      color: "#fc3158",
    });

  const settled = await Promise.allSettled(
    sources.map((s) => fetchIcalEvents(s.url, s.source, s.color))
  );

  const all: CalEvent[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  return all.filter((e) => {
    const s = new Date(e.start);
    const en = new Date(e.end);
    return s < endDate && en > startDate;
  });
}

async function fetchIcalEvents(
  url: string,
  source: "google" | "apple",
  defaultColor: string
): Promise<CalEvent[]> {
  const data = await ical.fromURL(url);
  const events: CalEvent[] = [];

  for (const event of Object.values(data)) {
    if (!event || event.type !== "VEVENT") continue;

    const raw = event as ical.VEvent;
    const start = raw.start as Date;
    const end = (raw.end as Date) ?? start;
    const allDay =
      !!(raw as unknown as { datetype?: string }).datetype &&
      (raw as unknown as { datetype: string }).datetype === "date";

    if (!start) continue;

    events.push({
      id: (raw.uid as string) || `${source}-${start.getTime()}`,
      title: (raw.summary as string) || "(no title)",
      start: toISO(start),
      end: toISO(end),
      allDay,
      color: defaultColor,
      source,
    });
  }

  return events;
}

function toISO(d: Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
