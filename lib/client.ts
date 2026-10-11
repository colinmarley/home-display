"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dayKey } from "./dates";
import type { AppState } from "./types";

const POLL_MS = 60_000;

/**
 * Polls /api/state. A failed poll keeps the current state — the screen only
 * ever moves forward to newer data, it never blanks.
 */
export function useAppState(initial: AppState) {
  const [state, setState] = useState(initial);
  const [online, setOnline] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as AppState;
      setState(next);
      setOnline(true);
      // A new deploy changed the bundle: reload to pick it up.
      if (next.version !== initial.version) window.location.reload();
    } catch {
      setOnline(false);
    } finally {
      inFlight.current = false;
    }
  }, [initial.version]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, setState, refresh, online };
}

/** Current time, ticking every `ms`. Null until mounted (avoids hydration mismatch). */
export function useNow(ms = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Today's date key in the display timezone; changes at local midnight. */
export function useToday(tz: string, serverTime: number): string {
  const now = useNow(30_000);
  return dayKey(now ?? new Date(serverTime), tz);
}

export async function api(path: string, method: string, data?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
