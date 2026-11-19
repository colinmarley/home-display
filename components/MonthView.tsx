"use client";

import { addDaysKey, diffDaysKey, keyParts, startOfWeekKey, weekdayName } from "@/lib/dates";
import { eventsOn, specialDateOn } from "@/lib/events";
import type { CalEvent, Settings } from "@/lib/types";

interface Props {
  month: string; // YYYY-MM-01
  today: string;
  events: CalEvent[];
  settings: Settings;
  onDay: (key: string) => void;
}

const MAX_PILLS = 2;

export default function MonthView({ month, today, events, settings, onDay }: Props) {
  const tz = settings.tz;
  const gridStart = startOfWeekKey(month);
  const { month: m } = keyParts(month);
  // 5 or 6 rows depending on the month.
  const lastOfMonth = addDaysKey(
    `${keyParts(month).year + (m === 12 ? 1 : 0)}-${String((m % 12) + 1).padStart(2, "0")}-01`,
    -1
  );
  const rows = Math.ceil((diffDaysKey(lastOfMonth, gridStart) + 1) / 7);
  const cells = Array.from({ length: rows * 7 }, (_, i) => addDaysKey(gridStart, i));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flexShrink: 0 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <div key={w} className="label" style={{ textAlign: "center", padding: "4px 0" }}>
            {weekdayName(w, true)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${rows}, 1fr)`, minHeight: 0 }}>
        {cells.map((key) => {
          const inMonth = keyParts(key).month === m;
          const isToday = key === today;
          const special = specialDateOn(key, settings);
          const dayEvents = eventsOn(events, key, tz);
          return (
            <div
              key={key}
              onClick={() => onDay(key)}
              style={{
                borderTop: "1px solid var(--border)",
                borderRight: "1px solid var(--border)",
                padding: 2,
                minWidth: 0,
                overflow: "hidden",
                opacity: inMonth ? 1 : 0.35,
                background: special ? "rgba(255,143,184,0.14)" : isToday ? "var(--accent-soft)" : undefined,
              }}
            >
              <div className="num" style={{ fontSize: "0.8rem", fontWeight: isToday ? 700 : 400, color: isToday ? "var(--accent)" : "var(--text-dim)", padding: "0 2px" }}>
                {keyParts(key).day}
                {special && ` ${special.emoji}`}
              </div>
              {dayEvents.slice(0, MAX_PILLS).map((e) => (
                <div
                  key={e.id}
                  className="event-pill"
                  style={{ background: e.color + "33", borderLeft: `2px solid ${e.color}`, fontSize: "0.68rem", padding: "1px 3px", marginTop: 1, whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                >
                  {e.title}
                </div>
              ))}
              {dayEvents.length > MAX_PILLS && (
                <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", padding: "0 3px" }}>+{dayEvents.length - MAX_PILLS} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
