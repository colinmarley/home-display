import { kvGet, kvSet } from "./store";
import { DEFAULT_TZ } from "./dates";
import type { Settings, WeatherSource } from "./types";

const WEATHER_SOURCES: WeatherSource[] = ["open-meteo", "open-meteo-gfs", "open-meteo-ecmwf", "nws"];

function envNumber(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && process.env[key] !== "" ? n : fallback;
}

function defaults(): Settings {
  const envSource = (process.env.WEATHER_SOURCE ?? "").trim().toLowerCase() as WeatherSource;
  return {
    tz: process.env.DISPLAY_TZ || DEFAULT_TZ,
    weatherSource: WEATHER_SOURCES.includes(envSource) ? envSource : "open-meteo",
    photoIntervalSec: envNumber("PHOTO_INTERVAL_SECONDS", 30),
    idleReturnMin: 2,
    idleSlideshowMin: envNumber("IDLE_TIMEOUT_MINUTES", 10),
    night: {
      enabled: true,
      start: "22:00",
      end: "06:30",
      offStart: "",
      dayBrightness: 100,
      nightBrightness: 15,
      wakeMinutes: 5,
    },
    calendars: {},
    specialDates: [
      {
        id: "christine-birthday",
        month: 5,
        day: 16,
        label: "Christine's Birthday",
        emoji: "🌸",
        theme: "pink",
        title: "Happy Birthday\nChristine!",
        message:
          "I love you more than words can say.\n" +
          "I’m so incredibly proud of you for stepping out in faith and getting baptized this year, " +
          "and for leading a small group of women at church who share a heart for learning about God " +
          "and living the life He wants.\n" +
          "You are the greatest mom to Daisy, and we all love you so much.",
        signoff: "Love, Colin ❤️",
      },
    ],
    countdowns: [],
  };
}

export function getSettings(): Settings {
  const d = defaults();
  const stored = kvGet<Partial<Settings>>("settings");
  if (!stored) return d;
  return { ...d, ...stored, night: { ...d.night, ...(stored.night ?? {}) } };
}

/** Shallow-merge a patch (night merged one level deeper) and persist. */
export function updateSettings(patch: Partial<Settings>): Settings {
  const cur = getSettings();
  const next: Settings = {
    ...cur,
    ...patch,
    night: { ...cur.night, ...(patch.night ?? {}) },
  };
  if (!WEATHER_SOURCES.includes(next.weatherSource)) next.weatherSource = cur.weatherSource;
  kvSet("settings", next);
  return next;
}
