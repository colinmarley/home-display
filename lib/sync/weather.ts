import { dayKey } from "../dates";
import type {
  CurrentWeather,
  DayForecast,
  HourForecast,
  WeatherAlert,
  WeatherPayload,
  WeatherSource,
} from "../types";

const TIMEOUT_MS = 20_000;
const NWS_HEADERS = {
  "User-Agent": "HomeDisplay/2.0 (home display; github.com/colinmarley/home-display)",
  Accept: "application/geo+json",
};

export const SOURCE_LABELS: Record<WeatherSource, string> = {
  "open-meteo": "Open-Meteo (best match)",
  "open-meteo-gfs": "Open-Meteo · NOAA GFS",
  "open-meteo-ecmwf": "Open-Meteo · ECMWF",
  nws: "National Weather Service",
};

const OPEN_METEO_MODELS: Partial<Record<WeatherSource, string>> = {
  "open-meteo-gfs": "gfs_seamless",
  "open-meteo-ecmwf": "ecmwf_ifs025",
};

function coords(): { lat: string; lon: string } {
  const lat = process.env.WEATHER_LAT?.trim();
  const lon = process.env.WEATHER_LON?.trim();
  if (!lat || !lon) throw new Error("WEATHER_LAT / WEATHER_LON not set");
  return { lat, lon };
}

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

const round = (n: number | null | undefined) => (typeof n === "number" ? Math.round(n) : null);

// ── Open-Meteo ───────────────────────────────────────────────────────────────

interface OpenMeteoResponse {
  current: { time: number; temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number };
  hourly: { time: number[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[] };
  daily: {
    time: number[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    sunrise: number[];
    sunset: number[];
    uv_index_max: (number | null)[];
  };
}

export async function fetchOpenMeteo(source: WeatherSource, tz: string): Promise<WeatherPayload> {
  const { lat, lon } = coords();
  const model = OPEN_METEO_MODELS[source];
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
    temperature_unit: "fahrenheit",
    timezone: tz,
    timeformat: "unixtime",
    forecast_days: "8",
    forecast_hours: "25",
  });
  if (model) params.set("models", model);
  const d = await getJson<OpenMeteoResponse>(`https://api.open-meteo.com/v1/forecast?${params}`);

  const current: CurrentWeather = {
    temperature: Math.round(d.current.temperature_2m),
    apparentTemperature: Math.round(d.current.apparent_temperature),
    weatherCode: d.current.weather_code,
    isDay: d.current.is_day === 1,
  };

  const hourly: HourForecast[] = d.hourly.time.map((t, i) => ({
    time: new Date(t * 1000).toISOString(),
    temperature: Math.round(d.hourly.temperature_2m[i]),
    precipProb: d.hourly.precipitation_probability[i] ?? null,
    weatherCode: d.hourly.weather_code[i],
  }));

  // Daily `time` is local midnight as a unix timestamp — key it in the display zone.
  const daily: DayForecast[] = d.daily.time.map((t, i) => ({
    date: dayKey(new Date(t * 1000), tz),
    weatherCode: d.daily.weather_code[i],
    tempMax: round(d.daily.temperature_2m_max[i]),
    tempMin: round(d.daily.temperature_2m_min[i]),
    precipProbMax: d.daily.precipitation_probability_max[i] ?? null,
    sunrise: new Date(d.daily.sunrise[i] * 1000).toISOString(),
    sunset: new Date(d.daily.sunset[i] * 1000).toISOString(),
    uvMax: d.daily.uv_index_max[i] ?? null,
  }));

  return { source, sourceLabel: SOURCE_LABELS[source], current, hourly, daily, alerts: [] };
}

// ── National Weather Service ─────────────────────────────────────────────────

interface NWSPeriod {
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
}

export function nwsTextToWmoCode(text: string): number {
  const t = text.toLowerCase();
  if (t.includes("thunderstorm") || t.includes("t-storm")) return 95;
  if (t.includes("blizzard") || t.includes("snow") || t.includes("flurr")) return 71;
  if (t.includes("freezing rain") || t.includes("sleet") || t.includes("wintry mix")) return 85;
  if (t.includes("heavy rain")) return 65;
  if (t.includes("rain") || t.includes("shower")) return 61;
  if (t.includes("drizzle")) return 51;
  if (t.includes("fog") || t.includes("mist") || t.includes("haze") || t.includes("smoke")) return 45;
  if (t.includes("mostly cloudy") || t.includes("overcast") || t.includes("cloudy")) return 3;
  if (t.includes("partly cloudy") || t.includes("partly sunny")) return 2;
  if (t.includes("mostly sunny") || t.includes("mostly clear")) return 1;
  return 0;
}

/**
 * Group NWS 12-hour periods into calendar days. A daytime period sets the
 * high and the day's icon; the night that *starts* that evening sets the low.
 * When only tonight remains for today, the high is null (not faked from the low).
 */
export function groupNwsPeriods(periods: NWSPeriod[], tz: string): DayForecast[] {
  const days = new Map<string, DayForecast>();
  for (const p of periods) {
    const key = dayKey(new Date(p.startTime), tz);
    const entry =
      days.get(key) ??
      ({ date: key, weatherCode: 0, tempMax: null, tempMin: null, precipProbMax: null } as DayForecast);
    const pop = p.probabilityOfPrecipitation?.value ?? null;
    if (pop !== null) entry.precipProbMax = Math.max(entry.precipProbMax ?? 0, pop);
    if (p.isDaytime) {
      entry.tempMax = p.temperature;
      entry.weatherCode = nwsTextToWmoCode(p.shortForecast);
    } else {
      entry.tempMin = p.temperature;
      if (entry.tempMax === null) entry.weatherCode = nwsTextToWmoCode(p.shortForecast);
    }
    days.set(key, entry);
  }
  return [...days.values()];
}

async function nwsPoints(lat: string, lon: string) {
  const points = await getJson<{ properties: { forecast: string; forecastHourly: string } }>(
    `https://api.weather.gov/points/${lat},${lon}`,
    NWS_HEADERS
  );
  return points.properties;
}

export async function fetchNws(tz: string): Promise<WeatherPayload> {
  const { lat, lon } = coords();
  const { forecast, forecastHourly } = await nwsPoints(lat, lon);
  const [daily, hourly] = await Promise.all([
    getJson<{ properties: { periods: NWSPeriod[] } }>(forecast, NWS_HEADERS),
    getJson<{ properties: { periods: NWSPeriod[] } }>(forecastHourly, NWS_HEADERS),
  ]);
  const hours = hourly.properties.periods.slice(0, 25);
  const now = hours[0];
  return {
    source: "nws",
    sourceLabel: SOURCE_LABELS.nws,
    current: now
      ? {
          temperature: Math.round(now.temperature),
          apparentTemperature: Math.round(now.temperature),
          weatherCode: nwsTextToWmoCode(now.shortForecast),
          isDay: now.isDaytime,
        }
      : null,
    hourly: hours.map((h) => ({
      time: new Date(h.startTime).toISOString(),
      temperature: Math.round(h.temperature),
      precipProb: h.probabilityOfPrecipitation?.value ?? null,
      weatherCode: nwsTextToWmoCode(h.shortForecast),
    })),
    daily: groupNwsPeriods(daily.properties.periods, tz),
    alerts: [],
  };
}

export async function fetchAlerts(): Promise<WeatherAlert[]> {
  const { lat, lon } = coords();
  const d = await getJson<{
    features: { properties: { id: string; event: string; headline: string | null; severity: string; ends: string | null; expires: string | null } }[];
  }>(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, NWS_HEADERS);
  return d.features.map(({ properties: p }) => ({
    id: p.id,
    event: p.event,
    headline: p.headline ?? p.event,
    severity: p.severity,
    ends: p.ends ?? p.expires ?? undefined,
  }));
}

export async function fetchWeather(source: WeatherSource, tz: string): Promise<WeatherPayload> {
  return source === "nws" ? fetchNws(tz) : fetchOpenMeteo(source, tz);
}

/** Forecast + alerts. Alerts are best-effort: their failure keeps the previous alerts. */
export async function syncWeather(
  source: WeatherSource,
  tz: string,
  prev: WeatherPayload | null
): Promise<{ payload: WeatherPayload; warning: string | null }> {
  const [forecast, alerts] = await Promise.allSettled([fetchWeather(source, tz), fetchAlerts()]);
  if (forecast.status === "rejected") throw forecast.reason;
  const payload = forecast.value;
  if (alerts.status === "fulfilled") {
    payload.alerts = alerts.value;
    return { payload, warning: null };
  }
  payload.alerts = prev?.alerts ?? [];
  return { payload, warning: `alerts: ${String(alerts.reason)}` };
}
