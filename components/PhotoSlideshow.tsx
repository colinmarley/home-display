"use client";

import { useEffect, useRef, useState } from "react";
import { addDaysKey, dayKey, formatTime, longDateLabel } from "@/lib/dates";
import { eventsOn, relativeStart } from "@/lib/events";
import type { AppState, PhotoAsset } from "@/lib/types";
import { weatherIcon } from "./weatherBits";

interface Props {
  assets: PhotoAsset[];
  intervalMs: number;
  state: AppState;
  now: Date;
  onExit: () => void;
}

const FADE_MS = 900;
const LOAD_TIMEOUT_MS = 20_000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const src = (id: string) => `/api/photo/proxy?id=${encodeURIComponent(id)}`;

function preload(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const t = setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(t);
      // decode() avoids a jank frame on the Pi when the image swaps in.
      img.decode().then(resolve, resolve);
    };
    img.onerror = () => {
      clearTimeout(t);
      reject(new Error("load failed"));
    };
    img.src = src(id);
  });
}

/**
 * Two stacked layers cross-fade. The next photo is fully loaded before it is
 * shown; a photo that fails is skipped and reported. The asset list comes from
 * the polled app state, so album changes show up without a reload.
 */
export default function PhotoSlideshow({ assets, intervalMs, state, now, onExit }: Props) {
  const [layers, setLayers] = useState<[string | null, string | null]>([null, null]);
  const [front, setFront] = useState<0 | 1>(0);
  const queue = useRef<string[]>([]);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const frontRef = useRef<0 | 1>(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const nextId = (): string | null => {
      const ids = new Set(assetsRef.current.map((a) => a.id));
      queue.current = queue.current.filter((id) => ids.has(id));
      if (!queue.current.length) queue.current = shuffle([...ids]); // no repeats within a cycle
      return queue.current.shift() ?? null;
    };

    const advance = async (attempts = 0) => {
      if (cancelled) return;
      const id = nextId();
      if (!id) {
        timer = setTimeout(() => advance(), 10_000); // album empty or not synced yet
        return;
      }
      try {
        await preload(id);
      } catch {
        void fetch("/api/photos/bad", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
        if (!cancelled) timer = setTimeout(() => advance(attempts + 1), attempts < 5 ? 500 : 15_000);
        return;
      }
      if (cancelled) return;
      const back = frontRef.current === 0 ? 1 : 0;
      setLayers((l) => {
        const n: [string | null, string | null] = [...l];
        n[back] = id;
        return n;
      });
      frontRef.current = back;
      setFront(back);
      timer = setTimeout(() => advance(), intervalMs);
    };

    void advance();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intervalMs]);

  const { settings, weather, calendar } = state;
  const tz = settings.tz;
  const today = dayKey(now, tz);
  const next = [...eventsOn(calendar?.events ?? [], today, tz), ...eventsOn(calendar?.events ?? [], addDaysKey(today, 1), tz)].find(
    (e) => !e.allDay && new Date(e.start) > now
  );
  const empty = !layers[0] && !layers[1];

  return (
    <div onClick={onExit} style={{ position: "fixed", inset: 0, background: "#000", zIndex: 40 }}>
      {layers.map((id, i) =>
        id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src(id)}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: front === i ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease`,
            }}
          />
        ) : null
      )}
      {empty && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)" }}>
          {assets.length ? "Loading photos…" : "No photos synced yet"}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "40px 22px 16px",
          background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        <div>
          <div className="num" style={{ fontSize: "2.6rem", fontWeight: 700, lineHeight: 1 }}>{formatTime(now, tz)}</div>
          <div style={{ fontSize: "0.95rem", opacity: 0.85 }}>{longDateLabel(today)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {weather?.current && (
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
              {weatherIcon(weather.current.weatherCode, weather.current.isDay)} {weather.current.temperature}°
            </div>
          )}
          {next && (
            <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>
              {next.title} · {relativeStart(next, now)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
