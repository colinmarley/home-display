import { isAdmin } from "@/lib/adminAuth";
import { getSettings } from "@/lib/settings";
import { fetchWeather, SOURCE_LABELS } from "@/lib/sync/weather";
import { json } from "@/lib/http";
import type { WeatherSource } from "@/lib/types";

export const dynamic = "force-dynamic";

// Live side-by-side of every provider, to pick the one that matches this spot.
export async function GET() {
  if (!(await isAdmin())) return json({ error: "unauthorized" }, 401);
  const tz = getSettings().tz;
  const sources = Object.keys(SOURCE_LABELS) as WeatherSource[];
  const results = await Promise.allSettled(sources.map((s) => fetchWeather(s, tz)));
  return json(
    results.map((r, i) =>
      r.status === "fulfilled"
        ? { source: sources[i], label: SOURCE_LABELS[sources[i]], current: r.value.current, daily: r.value.daily.slice(0, 5) }
        : { source: sources[i], label: SOURCE_LABELS[sources[i]], error: String(r.reason) }
    )
  );
}
