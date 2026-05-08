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
  const sources = getConfiguredSources();

  const settled = await Promise.allSettled(
    sources.map((s) => fetchIcalEvents(s.url, s.source, s.color))
  );

  const all: CalEvent[] = [];
  for (const [idx, r] of settled.entries()) {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      continue;
    }

    const failed = sources[idx];
    // Keep rendering available sources while surfacing what failed.
    console.error(
      `[calendar] Failed to fetch ${failed?.source ?? "unknown"} iCal source (${failed?.envKey ?? "unknown env"})`,
      r.reason
    );
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

function getConfiguredSources(): {
  url: string;
  source: "google" | "apple";
  color: string;
  envKey: string;
}[] {
  const byPrefix = (prefix: string): [string, string][] => {
    const entries = Object.entries(process.env)
      .filter(([k, v]) => k === prefix || k.startsWith(`${prefix}_`))
      .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
      .sort(([a], [b]) => a.localeCompare(b)) as [string, string][];

    return entries;
  };

  const google = byPrefix("GOOGLE_ICAL_URL").map(([envKey, url]) => ({
    url: normalizeIcalUrl(url),
    source: "google" as const,
    color: "#4285f4",
    envKey,
  }));

  const apple = [
    ...byPrefix("APPLE_ICAL_URL"),
    ...byPrefix("ICLOUD_ICAL_URL"),
  ].map(([envKey, url]) => ({
    url: normalizeIcalUrl(url),
    source: "apple" as const,
    color: "#fc3158",
    envKey,
  }));

  return [...google, ...apple];
}

function normalizeIcalUrl(url: string): string {
  const trimmed = url.trim().replace(/^['"]|['"]$/g, "");

  if (trimmed.startsWith("webcal://")) {
    return `https://${trimmed.slice("webcal://".length)}`;
  }

  return trimmed;
}

function toISO(d: Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
