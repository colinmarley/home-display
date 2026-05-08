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

interface ConfiguredSource {
  url: string;
  source: "google" | "apple";
  color: string;
  envKey: string;
}

export interface CalendarSourceDebug {
  envKey: string;
  source: "google" | "apple";
  urlPreview: string;
  ok: boolean;
  rawEventCount: number;
  inRangeEventCount: number;
  error?: string;
}

export interface CalendarDebugResult {
  ok: boolean;
  window: {
    start: string;
    end: string;
  };
  totalInRangeEvents: number;
  sources: CalendarSourceDebug[];
}

export async function getCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<CalEvent[]> {
  const { sources, settled } = await fetchCalendarSourceResults();
  const all: CalEvent[] = [];

  for (const [idx, r] of settled.entries()) {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      continue;
    }

    const failed = sources[idx];
    console.error(
      `[calendar] Failed to fetch ${failed?.source ?? "unknown"} iCal source (${failed?.envKey ?? "unknown env"})`,
      r.reason
    );
  }

  return all.filter((e) => {
    const eventStart = new Date(e.start);
    const eventEnd = new Date(e.end);
    return eventStart < endDate && eventEnd > startDate;
  });
}

export async function getCalendarDebug(
  startDate: Date,
  endDate: Date
): Promise<CalendarDebugResult> {
  const { sources, settled } = await fetchCalendarSourceResults();
  for (const [idx, r] of settled.entries()) {
    if (r.status === "rejected") {
      const failed = sources[idx];
      console.error(
        `[calendar] Failed to fetch ${failed?.source ?? "unknown"} iCal source (${failed?.envKey ?? "unknown env"})`,
        r.reason
      );
    }
  }

  const sourceDebug: CalendarSourceDebug[] = settled.map((r, idx) => {
    const src = sources[idx];

    if (r.status === "rejected") {
      return {
        envKey: src.envKey,
        source: src.source,
        urlPreview: redactUrl(src.url),
        ok: false,
        rawEventCount: 0,
        inRangeEventCount: 0,
        error: toErrorMessage(r.reason),
      };
    }

    const inRange = r.value.filter((e) => {
      const eventStart = new Date(e.start);
      const eventEnd = new Date(e.end);
      return eventStart < endDate && eventEnd > startDate;
    }).length;

    return {
      envKey: src.envKey,
      source: src.source,
      urlPreview: redactUrl(src.url),
      ok: true,
      rawEventCount: r.value.length,
      inRangeEventCount: inRange,
    };
  });

  return {
    ok: sourceDebug.every((s) => s.ok),
    window: {
      start: toISO(startDate),
      end: toISO(endDate),
    },
    totalInRangeEvents: sourceDebug.reduce(
      (sum, s) => sum + s.inRangeEventCount,
      0
    ),
    sources: sourceDebug,
  };
}

async function fetchCalendarSourceResults(): Promise<{
  sources: ConfiguredSource[];
  settled: PromiseSettledResult<CalEvent[]>[];
}> {
  const sources = getConfiguredSources();
  const settled = await Promise.allSettled(
    sources.map((s) => fetchIcalEvents(s.url, s.source, s.color))
  );
  return { sources, settled };
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

function getConfiguredSources(): ConfiguredSource[] {
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

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const shown = pathParts.slice(0, 2).join("/");
    const suffix = pathParts.length > 2 ? "/..." : "";
    return `${parsed.protocol}//${parsed.host}/${shown}${suffix}`;
  } catch {
    return "invalid-url";
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown error";
}

function toISO(d: Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
