export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

export interface WeatherData {
  current: CurrentWeather | null;
  forecast: DayForecast[];
  source?: string;
}

// Map NWS shortForecast text → approximate WMO weather code
// Used when WEATHER_SOURCE=nws so the existing emoji renderer keeps working
function nwsTextToWmoCode(text: string): number {
  const t = text.toLowerCase();
  if (t.includes("thunderstorm") || t.includes("t-storm")) return 95;
  if (t.includes("blizzard") || t.includes("snow") || t.includes("flurr")) return 71;
  if (t.includes("freezing rain") || t.includes("sleet") || t.includes("wintry mix")) return 85;
  if (t.includes("heavy rain")) return 65;
  if (t.includes("rain") || t.includes("shower")) return 61;
  if (t.includes("drizzle")) return 51;
  if (t.includes("fog") || t.includes("mist") || t.includes("haze")) return 45;
  if (t.includes("mostly cloudy") || t.includes("overcast") || t.includes("cloudy")) return 3;
  if (t.includes("partly cloudy") || t.includes("partly sunny")) return 2;
  if (t.includes("mostly sunny") || t.includes("mostly clear")) return 1;
  return 0; // sunny / clear
}

// ── Open-Meteo ───────────────────────────────────────────────────────────────
// model: undefined = ECMWF blend (default), "gfs_seamless" = NOAA GFS

async function getOpenMeteoData(model?: string): Promise<WeatherData> {
  const lat = process.env.WEATHER_LAT;
  const lon = process.env.WEATHER_LON;
  if (!lat || !lon) return { current: null, forecast: [], source: "open-meteo" };

  const modelParam = model ? `&models=${model}` : "";
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&current=weather_code,temperature_2m,apparent_temperature` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7` +
    modelParam;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { current: null, forecast: [], source: "open-meteo" };

  const data = await res.json();

  const current: CurrentWeather = {
    temperature: Math.round(data.current.temperature_2m as number),
    apparentTemperature: Math.round(data.current.apparent_temperature as number),
    weatherCode: data.current.weather_code as number,
  };

  const forecast: DayForecast[] = (data.daily.time as string[]).map(
    (date: string, i: number) => ({
      date,
      weatherCode: data.daily.weather_code[i] as number,
      tempMax: Math.round(data.daily.temperature_2m_max[i] as number),
      tempMin: Math.round(data.daily.temperature_2m_min[i] as number),
    })
  );

  return { current, forecast, source: model ? `open-meteo-${model}` : "open-meteo-ecmwf" };
}

// ── National Weather Service (api.weather.gov) ────────────────────────────────
// Uses NOAA GFS — same data as weather.gov and most US government forecasts

async function getNWSData(): Promise<WeatherData> {
  const lat = process.env.WEATHER_LAT;
  const lon = process.env.WEATHER_LON;
  if (!lat || !lon) return { current: null, forecast: [], source: "nws" };

  const headers = {
    "User-Agent": "HomeDisplay/1.0 (home automation display)",
    Accept: "application/geo+json",
  };

  // Step 1: resolve the grid point for our coordinates
  const pointsRes = await fetch(
    `https://api.weather.gov/points/${lat},${lon}`,
    { headers, cache: "no-store" }
  );
  if (!pointsRes.ok) return { current: null, forecast: [], source: "nws" };
  const points = await pointsRes.json();
  const { forecast: forecastUrl, forecastHourly: hourlyUrl } =
    points.properties as { forecast: string; forecastHourly: string };

  // Step 2: daily forecast + hourly forecast in parallel
  const [forecastRes, hourlyRes] = await Promise.all([
    fetch(forecastUrl, { headers, cache: "no-store" }),
    fetch(hourlyUrl, { headers, cache: "no-store" }),
  ]);
  if (!forecastRes.ok || !hourlyRes.ok)
    return { current: null, forecast: [], source: "nws" };

  const [forecastJson, hourlyJson] = await Promise.all([
    forecastRes.json() as Promise<{ properties: { periods: NWSPeriod[] } }>,
    hourlyRes.json() as Promise<{ properties: { periods: NWSPeriod[] } }>,
  ]);

  // Current conditions: first hourly period = this hour's forecast
  const nowPeriod = hourlyJson.properties.periods[0];
  const current: CurrentWeather = {
    temperature: Math.round(nowPeriod.temperature),
    // NWS basic API doesn't surface feels-like; use same value
    apparentTemperature: Math.round(nowPeriod.temperature),
    weatherCode: nwsTextToWmoCode(nowPeriod.shortForecast),
  };

  // Daily forecast: group day/night 12-hour periods by local date
  type Entry = { high: number; low: number; weatherCode: number };
  const dayMap = new Map<string, Entry>();

  for (const period of forecastJson.properties.periods) {
    // startTime is RFC3339 with offset, e.g. "2026-06-06T06:00:00-07:00"
    const date = period.startTime.substring(0, 10);
    const entry = dayMap.get(date) ?? {
      high: -Infinity,
      low: Infinity,
      weatherCode: 0,
    };

    if (period.isDaytime) {
      if (period.temperature > entry.high) {
        entry.high = period.temperature;
        entry.weatherCode = nwsTextToWmoCode(period.shortForecast);
      }
    } else {
      entry.low = Math.min(entry.low, period.temperature);
      // If the current period is evening (no daytime period yet), use night description
      if (!isFinite(entry.high)) {
        entry.weatherCode = nwsTextToWmoCode(period.shortForecast);
      }
    }

    dayMap.set(date, entry);
  }

  const forecast: DayForecast[] = Array.from(dayMap.entries())
    .slice(0, 7)
    .map(([date, v]) => ({
      date,
      weatherCode: v.weatherCode,
      // Fall back gracefully if only day or only night period exists
      tempMax: isFinite(v.high) ? Math.round(v.high) : Math.round(v.low),
      tempMin: isFinite(v.low) ? Math.round(v.low) : Math.round(v.high),
    }));

  return { current, forecast, source: "nws" };
}

interface NWSPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  shortForecast: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getWeatherData(): Promise<WeatherData> {
  const source = (process.env.WEATHER_SOURCE ?? "open-meteo").trim().toLowerCase();

  if (source === "nws") return getNWSData();
  if (source === "open-meteo-gfs") return getOpenMeteoData("gfs_seamless");
  return getOpenMeteoData(); // default: ECMWF blend
}

export async function getWeekForecast(): Promise<DayForecast[]> {
  return (await getWeatherData()).forecast;
}
