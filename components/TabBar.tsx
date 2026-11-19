"use client";

import { formatTime } from "@/lib/dates";
import type { SyncStatus } from "@/lib/types";

export type Tab = "today" | "calendar" | "weather" | "lists" | "photos";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "today", icon: "🏠", label: "Today" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "weather", icon: "⛅", label: "Weather" },
  { id: "lists", icon: "📝", label: "Lists" },
  { id: "photos", icon: "🖼️", label: "Photos" },
];

export function syncHealth(sync: SyncStatus[], online: boolean): "ok" | "warn" | "error" {
  if (!online) return "error";
  if (sync.some((s) => s.stale && s.error)) return "error";
  if (sync.some((s) => s.stale || s.error)) return "warn";
  return "ok";
}

const DOT_COLOR = { ok: "var(--ok)", warn: "var(--warn)", error: "var(--danger)" };

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  now: Date | null;
  tz: string;
  sync: SyncStatus[];
  online: boolean;
  onSync: () => void;
}

export default function TabBar({ tab, onTab, now, tz, sync, online, onSync }: Props) {
  const health = syncHealth(sync, online);
  return (
    <nav className="tabbar" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}>
          <span className="tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
      <button
        onClick={onSync}
        aria-label="Sync status"
        style={{ width: 150, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 16px" }}
      >
        <span className="num" style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          {now ? formatTime(now, tz) : ""}
        </span>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: DOT_COLOR[health],
            boxShadow: health === "ok" ? "none" : `0 0 8px ${DOT_COLOR[health]}`,
          }}
        />
      </button>
    </nav>
  );
}
