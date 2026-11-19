import { inWindow, minutesOfDay, parseHHMM } from "./dates";
import type { DisplayState, Settings } from "./types";

// Night/dim schedule for the Pi backlight. The kiosk page and the Pi's
// display agent both read this; a touch at night calls wake().

const g = globalThis as unknown as { __homeDisplayDisplay?: { wakeUntil: number | null; lastHeartbeat: number | null } };

function mem() {
  g.__homeDisplayDisplay ??= { wakeUntil: null, lastHeartbeat: null };
  return g.__homeDisplayDisplay;
}

export function computeDisplay(
  settings: Settings,
  now: Date,
  wakeUntil: number | null,
  lastHeartbeat: number | null = null
): DisplayState {
  const n = settings.night;
  const base = { wakeUntil, lastHeartbeat };
  const day: DisplayState = { mode: "day", brightness: n.dayBrightness, ...base };
  if (!n.enabled) return day;
  if (wakeUntil && wakeUntil > now.getTime()) return day;

  const m = minutesOfDay(now, settings.tz);
  const start = parseHHMM(n.start);
  const end = parseHHMM(n.end);
  if (!inWindow(m, start, end)) return day;
  if (n.offStart && inWindow(m, parseHHMM(n.offStart), end)) {
    return { mode: "off", brightness: 0, ...base };
  }
  return { mode: "dim", brightness: n.nightBrightness, ...base };
}

export function displayState(settings: Settings, now = new Date()): DisplayState {
  const s = mem();
  return computeDisplay(settings, now, s.wakeUntil, s.lastHeartbeat);
}

export function wake(settings: Settings, now = Date.now()): void {
  mem().wakeUntil = now + settings.night.wakeMinutes * 60_000;
}

export function heartbeat(now = Date.now()): void {
  mem().lastHeartbeat = now;
}
