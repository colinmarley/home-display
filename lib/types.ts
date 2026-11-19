// Shapes shared between the sync layer (server) and the UI (client).

export interface CalEvent {
  id: string;
  title: string;
  location?: string;
  calendarId: string;
  calendarName: string;
  color: string;
  allDay: boolean;
  /** All-day: YYYY-MM-DD. Timed: ISO instant. */
  start: string;
  /** All-day: YYYY-MM-DD, exclusive. Timed: ISO instant. */
  end: string;
}

export interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  source: "google" | "icloud" | "ics";
}

export interface CalendarSourceStatus {
  key: string;
  ok: boolean;
  error?: string;
  syncedAt?: number;
  eventCount: number;
}

export interface CalendarPayload {
  windowStart: string; // YYYY-MM-DD
  windowEnd: string; // YYYY-MM-DD
  calendars: CalendarInfo[];
  events: CalEvent[];
  sources: CalendarSourceStatus[];
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  isDay: boolean;
}

export interface HourForecast {
  time: string; // ISO instant
  temperature: number;
  precipProb: number | null;
  weatherCode: number;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD in the display timezone
  weatherCode: number;
  tempMax: number | null; // null when only the overnight period is left
  tempMin: number | null;
  precipProbMax: number | null;
  sunrise?: string;
  sunset?: string;
  uvMax?: number | null;
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  ends?: string;
}

export interface WeatherPayload {
  source: string;
  sourceLabel: string;
  current: CurrentWeather | null;
  hourly: HourForecast[];
  daily: DayForecast[];
  alerts: WeatherAlert[];
}

export interface PhotoAsset {
  id: string;
  takenAt?: string;
}

export interface PhotosPayload {
  albumName: string;
  assets: PhotoAsset[];
  cached: number;
}

export interface SpecialDate {
  id: string;
  month: number;
  day: number;
  /** Short label shown on the calendar cell / day header. */
  label: string;
  emoji: string;
  theme: "pink" | "gold" | "blue";
  /** Full-screen surprise; leave title empty to skip the overlay. */
  title: string;
  message: string;
  signoff: string;
}

export interface Countdown {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  emoji: string;
}

export type WeatherSource = "open-meteo" | "open-meteo-gfs" | "open-meteo-ecmwf" | "nws";

export interface Settings {
  tz: string;
  weatherSource: WeatherSource;
  photoIntervalSec: number;
  /** Return to Today after this many idle minutes (0 = never). */
  idleReturnMin: number;
  /** Start the slideshow after this many idle minutes (0 = never). */
  idleSlideshowMin: number;
  night: {
    enabled: boolean;
    start: string; // "HH:MM"
    end: string;
    /** Screen fully off (backlight 0) from this time until `end`; empty = stay dim. */
    offStart: string;
    dayBrightness: number; // 0-100
    nightBrightness: number; // 0-100
    wakeMinutes: number;
  };
  calendars: Record<string, { hidden?: boolean; color?: string }>;
  specialDates: SpecialDate[];
  countdowns: Countdown[];
}

export interface ListItem {
  id: number;
  listId: number;
  text: string;
  done: boolean;
  position: number;
}

export interface ShoppingList {
  id: number;
  name: string;
  emoji: string;
  items: ListItem[];
}

export interface SyncStatus {
  source: string;
  syncedAt: number | null;
  lastAttemptAt: number | null;
  error: string | null;
  stale: boolean;
}

export type DisplayMode = "day" | "dim" | "off";

export interface DisplayState {
  mode: DisplayMode;
  brightness: number; // 0-100, what the backlight should be right now
  wakeUntil: number | null;
  lastHeartbeat: number | null;
}

export interface AppState {
  serverTime: number;
  version: string;
  settings: Settings;
  calendar: CalendarPayload | null;
  weather: WeatherPayload | null;
  photos: PhotosPayload | null;
  lists: ShoppingList[];
  sync: SyncStatus[];
  display: DisplayState;
}
