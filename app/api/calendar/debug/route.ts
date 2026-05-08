import { addWeeks, startOfWeek } from "date-fns";
import { getCalendarDebug, getCalendarEvents } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeSamples = url.searchParams.get("samples") === "1";

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const fetchEnd = addWeeks(weekStart, 3);

  const [debug, events] = await Promise.all([
    getCalendarDebug(weekStart, fetchEnd),
    includeSamples ? getCalendarEvents(weekStart, fetchEnd) : Promise.resolve([]),
  ]);

  const bySource = debug.sources.reduce(
    (acc, source) => {
      acc[source.source] = (acc[source.source] ?? 0) + source.inRangeEventCount;
      return acc;
    },
    {} as Record<string, number>
  );

  const sampleEvents = includeSamples
    ? events
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 25)
        .map((e) => ({
          id: e.id,
          source: e.source,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
        }))
    : undefined;

  return Response.json(
    {
      ok: debug.ok,
      now: now.toISOString(),
      window: debug.window,
      totalInRangeEvents: debug.totalInRangeEvents,
      totalBySource: bySource,
      sourceStatus: debug.sources,
      ...(includeSamples ? { sampleEvents } : {}),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
