"use client";

import { addDaysKey, formatTime, keyParts, weekdayName, weekdayOfKey } from "@/lib/dates";
import { eventsOn, specialDateOn, startsBefore } from "@/lib/events";
import type { CalEvent, Settings } from "@/lib/types";

interface Props {
  weekStart: string;
  today: string;
  events: CalEvent[];
  settings: Settings;
  onDay: (key: string) => void;
}

export default function WeekView({ weekStart, today, events, settings, onDay }: Props) {
  const tz = settings.tz;
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {days.map((key, i) => {
        const isToday = key === today;
        const past = key < today;
        const special = specialDateOn(key, settings);
        const dayEvents = eventsOn(events, key, tz);
        return (
          <div
            key={key}
            onClick={() => onDay(key)}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              borderRight: i < 6 ? "1px solid var(--border)" : undefined,
              background: special ? "rgba(255,143,184,0.14)" : isToday ? "var(--accent-soft)" : undefined,
              opacity: past ? 0.6 : 1,
            }}
          >
            <div style={{ textAlign: "center", padding: "6px 0 4px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div className="label" style={{ color: isToday ? "var(--accent)" : undefined }}>
                {weekdayName(weekdayOfKey(key), true)}
              </div>
              <div className="num" style={{ fontSize: "1.2rem", fontWeight: isToday ? 700 : 500, color: isToday ? "var(--accent)" : undefined }}>
                {keyParts(key).day}
                {special && <span style={{ fontSize: "0.85rem", marginLeft: 2 }}>{special.emoji}</span>}
              </div>
            </div>
            <div className="scroll-y" style={{ flex: 1, padding: 3, display: "flex", flexDirection: "column", gap: 3 }}>
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className="event-pill"
                  style={{
                    background: e.allDay ? e.color + "55" : e.color + "26",
                    borderLeft: `3px solid ${e.color}`,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    flexShrink: 0,
                  }}
                >
                  {!e.allDay && (
                    <span className="num" style={{ color: "var(--text-dim)", marginRight: 4 }}>
                      {startsBefore(e, key, tz) ? "…" : formatTime(e.start, tz, true)}
                    </span>
                  )}
                  {e.title}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
