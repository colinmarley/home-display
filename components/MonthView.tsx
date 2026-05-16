"use client";

import { useState } from "react";
import type { CalEvent } from "@/lib/calendar";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";

interface Props {
  events: CalEvent[];
  onDaySelect: (dateISO: string) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function eventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return events.filter((e) => {
    const s = new Date(e.start);
    const en = new Date(e.end);
    return s <= dayEnd && en >= dayStart;
  });
}

function buildCalendarGrid(monthDate: Date): Date[] {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  const gridEnd = startOfWeek(addDays(last, 7), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cur = gridStart;
  while (cur < gridEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function isBirthdayDate(d: Date): boolean {
  return d.getMonth() === 4 && d.getDate() === 16; // May 16
}

export default function MonthView({ events, onDaySelect }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const days = buildCalendarGrid(viewMonth);
  const monthLabel = format(viewMonth, "MMMM yyyy");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Month header with prev/next */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          onPointerDown={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          style={navBtnStyle}
        >
          ‹
        </button>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
          {monthLabel}
        </span>
        <button
          onPointerDown={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          style={navBtnStyle}
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flexShrink: 0 }}>
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              padding: "4px 0",
              fontSize: "0.6rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-dim)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isToday = isSameDay(day, today);
          const isBirthday = isBirthdayDate(day);
          const dayEvents = eventsForDay(events, day);
          const isLastRow = i >= days.length - 7;

          return (
            <div
              key={i}
              onPointerDown={() => onDaySelect(format(day, "yyyy-MM-dd"))}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRight: (i % 7) < 6 ? "1px solid var(--border)" : undefined,
                borderBottom: !isLastRow ? "1px solid var(--border)" : undefined,
                background: isBirthday
                  ? "rgba(255,182,193,0.55)"
                  : isToday
                  ? "var(--accent-today)"
                  : undefined,
                opacity: inMonth ? 1 : 0.3,
                padding: "3px 4px",
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              {/* Day number + birthday indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: isToday || isBirthday ? 700 : 400,
                    color: isBirthday
                      ? "#c2185b"
                      : isToday
                      ? "var(--accent-google)"
                      : "var(--text)",
                    lineHeight: 1.4,
                  }}
                >
                  {day.getDate()}
                </span>
                {isBirthday && (
                  <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>🌸</span>
                )}
              </div>

              {/* Events */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden" }}>
                {dayEvents.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    style={{
                      background: e.color + "33",
                      borderLeft: `2px solid ${e.color}`,
                      borderRadius: "2px",
                      padding: "2px 4px",
                      fontSize: "0.74rem",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "var(--text)",
                    }}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 5 && (
                  <span style={{ fontSize: "0.62rem", color: "var(--text-dim)", paddingLeft: "2px" }}>
                    +{dayEvents.length - 5} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-dim)",
  fontSize: "1.2rem",
  padding: "2px 10px",
  borderRadius: "4px",
  lineHeight: 1,
};
