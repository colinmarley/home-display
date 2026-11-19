"use client";

import { formatTime, longDateLabel, dayKey } from "@/lib/dates";

/**
 * Night mode. "dim": a faint clock that drifts slowly (no burn-in) while the
 * Pi agent lowers the backlight. "off": pure black; the agent turns the
 * backlight off. Any touch wakes the screen (handled by AppShell).
 */
export default function NightClock({ now, tz, off }: { now: Date; tz: string; off: boolean }) {
  const drift = Math.floor(now.getTime() / 120_000) % 8; // shift every 2 min
  const dx = [0, 30, 60, 30, 0, -30, -60, -30][drift];
  const dy = [0, 20, 0, -20, 0, 20, 0, -20][drift];
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {!off && (
        <div style={{ textAlign: "center", color: "#3a3f4b", transform: `translate(${dx}px, ${dy}px)` }}>
          <div className="num" style={{ fontSize: "6rem", fontWeight: 300, lineHeight: 1 }}>{formatTime(now, tz).replace(/ (AM|PM)$/, "")}</div>
          <div style={{ fontSize: "1.1rem", marginTop: 8 }}>{longDateLabel(dayKey(now, tz))}</div>
        </div>
      )}
    </div>
  );
}
