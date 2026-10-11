"use client";

import { formatTime } from "@/lib/dates";
import { wmoToLabel } from "@/lib/wmo";
import type { AppState } from "@/lib/types";
import { AlertBanner, HourlyStrip, dayLabel, temp, weatherIcon } from "./weatherBits";
import { ago } from "./SyncPanel";

export default function WeatherView({ state, today }: { state: AppState; today: string }) {
  const { weather, settings } = state;
  const tz = settings.tz;
  const now = new Date();
  if (!weather) {
    return <div style={{ padding: 24, color: "var(--text-dim)" }}>Weather hasn&apos;t synced yet.</div>;
  }
  // Never show a day that has already ended, even if the last sync was before midnight.
  const days = weather.daily.filter((d) => d.date >= today).slice(0, 7);
  const lows = days.map((d) => d.tempMin ?? d.tempMax ?? 0);
  const highs = days.map((d) => d.tempMax ?? d.tempMin ?? 0);
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  const span = Math.max(hi - lo, 1);
  const syncedAt = state.sync.find((s) => s.source === "weather")?.syncedAt;
  const todayWx = days[0]?.date === today ? days[0] : undefined;

  return (
    <div className="scroll-y" style={{ height: "100%", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <AlertBanner alerts={weather.alerts} />
      <div style={{ display: "flex", gap: 14 }}>
        {weather.current && (
          <div className="card" style={{ width: 250, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "3rem", lineHeight: 1 }}>{weatherIcon(weather.current.weatherCode, weather.current.isDay)}</span>
              <span className="num" style={{ fontSize: "2.6rem", fontWeight: 700 }}>{weather.current.temperature}°</span>
            </div>
            <div>{wmoToLabel(weather.current.weatherCode)}</div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>Feels like {weather.current.apparentTemperature}°</div>
            {todayWx?.sunrise && todayWx.sunset && (
              <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                🌅 {formatTime(todayWx.sunrise, tz)} · 🌇 {formatTime(todayWx.sunset, tz)}
              </div>
            )}
            {typeof todayWx?.uvMax === "number" && (
              <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>UV max {Math.round(todayWx.uvMax)}</div>
            )}
          </div>
        )}
        <div className="card" style={{ flex: 1, padding: "12px 8px" }}>
          <div className="label" style={{ padding: "0 6px 8px" }}>Next 12 hours</div>
          <HourlyStrip hours={weather.hourly} tz={tz} count={12} now={now} />
        </div>
      </div>

      <div className="card" style={{ padding: "6px 14px" }}>
        {days.map((d) => {
          const left = (((d.tempMin ?? d.tempMax ?? lo) - lo) / span) * 100;
          const right = (((d.tempMax ?? d.tempMin ?? hi) - lo) / span) * 100;
          return (
            <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: 52, fontWeight: d.date === today ? 700 : 400 }}>{dayLabel(d.date, today)}</span>
              <span style={{ fontSize: "1.3rem", width: 30 }}>{weatherIcon(d.weatherCode)}</span>
              <span className="num" style={{ width: 48, color: "var(--rain)", fontSize: "0.8rem" }}>
                {(d.precipProbMax ?? 0) >= 10 ? `💧${d.precipProbMax}%` : ""}
              </span>
              <span className="num" style={{ width: 36, textAlign: "right", color: "var(--text-dim)" }}>{temp(d.tempMin)}</span>
              <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-2)", position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${Math.max(right - left, 3)}%`,
                    top: 0,
                    bottom: 0,
                    borderRadius: 3,
                    background: "linear-gradient(90deg, #6ab7ff, #f9ab00)",
                  }}
                />
              </span>
              <span className="num" style={{ width: 36, fontWeight: 600 }}>{temp(d.tempMax)}</span>
            </div>
          );
        })}
      </div>
      <div className="label" style={{ textAlign: "right" }}>
        {weather.sourceLabel} · updated {ago(syncedAt, Date.now())}
      </div>
    </div>
  );
}
