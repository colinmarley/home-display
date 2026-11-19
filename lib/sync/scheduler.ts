import { getSnapshot, recordSyncError, saveSnapshot } from "../store";
import { getSettings } from "../settings";
import { syncCalendar, type CalendarInternal } from "./calendar";
import { syncWeather } from "./weather";
import { syncPhotos } from "./photos";
import type { WeatherPayload } from "../types";

// Background sync. Each source runs on its own timer; success replaces the
// stored snapshot, failure only records the error (the last good data stays
// on screen) and retries with exponential backoff capped at the interval.

interface Job {
  source: string;
  intervalMs: number;
  run: () => Promise<{ payload: unknown; warning: string | null }>;
}

export const JOBS: Job[] = [
  {
    source: "calendar",
    intervalMs: 5 * 60_000,
    run: () => syncCalendar(getSettings().tz, getSnapshot<CalendarInternal>("calendar")?.payload ?? null),
  },
  {
    source: "weather",
    intervalMs: 15 * 60_000,
    run: () => {
      const s = getSettings();
      return syncWeather(s.weatherSource, s.tz, getSnapshot<WeatherPayload>("weather")?.payload ?? null);
    },
  },
  {
    source: "photos",
    intervalMs: 30 * 60_000,
    run: () => syncPhotos(),
  },
];

const MIN_RETRY_MS = 30_000;

interface JobState {
  timer: NodeJS.Timeout | null;
  failures: number;
  running: Promise<void> | null;
}

const g = globalThis as unknown as { __homeDisplaySync?: Map<string, JobState> };

function states(): Map<string, JobState> {
  g.__homeDisplaySync ??= new Map();
  return g.__homeDisplaySync;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function schedule(job: Job, delayMs: number) {
  const st = states().get(job.source)!;
  if (st.timer) clearTimeout(st.timer);
  const jitter = Math.random() * Math.min(delayMs * 0.1, 30_000);
  st.timer = setTimeout(() => void runJob(job), delayMs + jitter);
  st.timer.unref?.();
}

async function runJob(job: Job): Promise<void> {
  const st = states().get(job.source)!;
  if (st.running) return st.running;
  st.running = (async () => {
    try {
      const { payload, warning } = await job.run();
      saveSnapshot(job.source, payload, warning);
      st.failures = 0;
      if (warning) console.warn(`[sync] ${job.source} partial: ${warning}`);
      schedule(job, job.intervalMs);
    } catch (e) {
      st.failures++;
      recordSyncError(job.source, errText(e));
      console.error(`[sync] ${job.source} failed (${st.failures}x): ${errText(e)}`);
      schedule(job, Math.min(job.intervalMs, MIN_RETRY_MS * 2 ** (st.failures - 1)));
    } finally {
      st.running = null;
    }
  })();
  return st.running;
}

/** Start all jobs; resolves once each has had a first attempt (or `waitMs` passes). */
export async function startSync(waitMs = 15_000): Promise<void> {
  const first: Promise<void>[] = [];
  for (const job of JOBS) {
    if (states().has(job.source)) continue; // dev hot-reload: already running
    states().set(job.source, { timer: null, failures: 0, running: null });
    first.push(runJob(job));
  }
  await Promise.race([Promise.allSettled(first), new Promise((r) => setTimeout(r, waitMs))]);
}

/** Run a source now (admin "sync now", settings change). */
export async function syncNow(source: string): Promise<void> {
  const job = JOBS.find((j) => j.source === source);
  if (!job) throw new Error(`unknown source ${source}`);
  if (!states().has(source)) states().set(source, { timer: null, failures: 0, running: null });
  await runJob(job);
}

export const STALE_FACTOR = 3;

export function jobInterval(source: string): number {
  return JOBS.find((j) => j.source === source)?.intervalMs ?? 15 * 60_000;
}
