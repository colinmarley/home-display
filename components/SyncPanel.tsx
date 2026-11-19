"use client";

import type { AppState } from "@/lib/types";

const NAMES: Record<string, string> = { calendar: "Calendars", weather: "Weather", photos: "Photos" };

export function ago(ts: number | null | undefined, now: number): string {
  if (!ts) return "never";
  const m = Math.round((now - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export default function SyncPanel({ state, online, onClose }: { state: AppState; online: boolean; onClose: () => void }) {
  const now = Date.now();
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div className="card" style={{ width: 520, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ fontSize: "1.1rem" }}>Sync status</strong>
          <span className="label">{online ? "server reachable" : "server unreachable — showing last data"}</span>
        </div>
        {state.sync.map((s) => (
          <div key={s.source} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{NAMES[s.source] ?? s.source}</span>
              <span style={{ color: s.stale ? "var(--warn)" : "var(--text-dim)" }}>updated {ago(s.syncedAt, now)}</span>
            </div>
            {s.error && <div style={{ color: s.stale ? "var(--danger)" : "var(--warn)", fontSize: "0.78rem", marginTop: 2 }}>{s.error}</div>}
          </div>
        ))}
        {state.calendar?.sources.map((c) => (
          <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-dim)", padding: "2px 0 2px 12px" }}>
            <span>{c.key}</span>
            <span>{c.ok ? `${c.eventCount} events` : `failing — kept ${c.eventCount} events`}</span>
          </div>
        ))}
        <div className="label" style={{ marginTop: 14, textAlign: "center" }}>
          Settings: open http://&lt;this server&gt;:3001/admin on your phone · tap to close
        </div>
      </div>
    </div>
  );
}
