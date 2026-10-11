import fs from "node:fs";
import path from "node:path";
import { allSnapshots, getLists, getSnapshot } from "./store";
import { getSettings } from "./settings";
import { publicCalendar, type CalendarInternal } from "./sync/calendar";
import { jobInterval, STALE_FACTOR } from "./sync/scheduler";
import { displayState } from "./display";
import { badPhotoIds } from "./badPhotos";
import type { AppState, PhotosPayload, SyncStatus, WeatherPayload } from "./types";

/** Next's build id: changes on every deploy, which tells open kiosks to reload. */
export const APP_VERSION = (() => {
  try {
    return fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "dev";
  }
})();

/** Everything the kiosk needs, read from the local store — never from upstream services. */
export function buildState(now = Date.now()): AppState {
  const settings = getSettings();
  const cal = getSnapshot<CalendarInternal>("calendar");
  const weather = getSnapshot<WeatherPayload>("weather");
  const photos = getSnapshot<PhotosPayload>("photos");

  const bad = badPhotoIds(now);
  const photosPayload = photos?.payload
    ? { ...photos.payload, assets: photos.payload.assets.filter((a) => !bad.has(a.id)) }
    : null;

  const sync: SyncStatus[] = allSnapshots().map((s) => ({
    source: s.source,
    syncedAt: s.syncedAt,
    lastAttemptAt: s.lastAttemptAt,
    error: s.lastError,
    stale: !s.syncedAt || now - s.syncedAt > jobInterval(s.source) * STALE_FACTOR,
  }));

  return {
    serverTime: now,
    version: APP_VERSION,
    settings,
    calendar: publicCalendar(cal?.payload ?? null, settings.calendars),
    weather: weather?.payload ?? null,
    photos: photosPayload,
    lists: getLists(),
    sync,
    display: displayState(settings, new Date(now)),
  };
}
