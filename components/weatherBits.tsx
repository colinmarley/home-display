"use client";

import { formatTime, weekdayName, weekdayOfKey, zonedParts } from "@/lib/dates";
import { wmoToEmoji } from "@/lib/wmo";
import type { HourForecast, WeatherAlert } from "@/lib/types";

export function dayLabel(key: string, today: string): string {
  return key === today ? "Today" : weekdayName(weekdayOfKey(key), true);
}

export function temp(n: number | null | undefined): string {
  return typeof n === "number" ? `${n}°` : "–";
}

/** Night-time icon for clear/mostly-clear codes. */
export function weatherIcon(code: number, isDay = true): string {
  if (!isDay && code <= 1) return "🌙";
  if (!isDay && code === 2) return "☁️";
  return wmoToEmoji(code);
}

export function HourlyStrip({ hours, tz, count, now }: { hours: HourForecast[]; tz: string; count: number; now: Date }) {
  const upcoming = hours.filter((h) => new Date(h.time).getTime() > now.getTime() - 60 * 60_000).slice(0, count);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {upcoming.map((h, i) => {
        const hour = zonedParts(new Date(h.time), tz).hour;
        const night = hour < 7 || hour >= 19;
        return (
          <div key={h.time} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span className="label" style={{ letterSpacing: 0 }}>{i === 0 ? "Now" : formatTime(h.time, tz, true)}</span>
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{weatherIcon(h.weatherCode, !night)}</span>
            <span className="num" style={{ fontWeight: 600 }}>{h.temperature}°</span>
            <span className="num" style={{ fontSize: "0.68rem", color: "var(--rain)", visibility: (h.precipProb ?? 0) >= 10 ? "visible" : "hidden" }}>
              💧{h.precipProb ?? 0}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AlertBanner({ alerts }: { alerts: WeatherAlert[] }) {
  if (!alerts.length) return null;
  const a = alerts[0];
  const severe = a.severity === "Severe" || a.severity === "Extreme";
  return (
    <div
      style={{
        background: severe ? "rgba(234,67,53,0.2)" : "rgba(249,171,0,0.16)",
        border: `1px solid ${severe ? "var(--danger)" : "var(--warn)"}`,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: "0.8rem",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span>⚠️</span>
      <span style={{ fontWeight: 600 }}>{a.event}</span>
      <span style={{ color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {a.headline}
      </span>
      {alerts.length > 1 && <span className="label">+{alerts.length - 1}</span>}
    </div>
  );
}
