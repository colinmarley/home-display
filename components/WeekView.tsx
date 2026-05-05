"use client";

import type { CalEvent } from "@/lib/calendar";
import { startOfWeek, addDays, isSameDay, format } from "date-fns";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  events: CalEvent[];
  onDaySelect: (dateISO: string) => void;
}

function getWeekDays(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function eventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  return events.filter((e) => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    // Include all-day events and events that overlap the day
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    return start <= dayEnd && end >= dayStart;
  });
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "p" : "a";
  const h12 = h % 12 || 12;
  return m === "00" ? `${h12}${ampm}` : `${h12}:${m}${ampm}`;
}

export default function WeekView({ events, onDaySelect }: Props) {
  const today = new Date();
  const days = getWeekDays(today);

  return (
    <div
      className="flex h-full"
      style={{ borderLeft: "1px solid var(--border)" }}
    >
      {days.map((day, i) => {
        const isToday = isSameDay(day, today);
        const dayEvents = eventsForDay(events, day);

        return (
          <div
            key={i}
            className="flex flex-col flex-1"
            style={{
              borderRight: i < 6 ? "1px solid var(--border)" : undefined,
              background: isToday ? "var(--accent-today)" : undefined,
              minWidth: 0,
            }}
            onPointerDown={() => onDaySelect(format(day, "yyyy-MM-dd"))}
          >
            {/* Header */}
            <div
              className="flex flex-col items-center py-2"
              style={{
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-dim)",
                }}
              >
                {DAY_SHORT[i]}
              </span>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "var(--accent-google)" : "var(--text)",
                  lineHeight: 1.2,
                }}
              >
                {day.getDate()}
              </span>
            </div>

            {/* Events */}
            <div
              className="flex flex-col gap-0.5 p-0.5 overflow-hidden"
              style={{ flex: 1 }}
            >
              {dayEvents.slice(0, 8).map((e) => (
                <div
                  key={e.id}
                  style={{
                    background: e.color + "33",
                    borderLeft: `2px solid ${e.color}`,
                    borderRadius: "2px",
                    padding: "1px 3px",
                    fontSize: "0.62rem",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    color: "var(--text)",
                  }}
                  title={e.title}
                >
                  {!e.allDay && (
                    <span style={{ color: "var(--text-dim)", marginRight: "2px" }}>
                      {formatEventTime(e.start)}
                    </span>
                  )}
                  {e.title}
                </div>
              ))}
              {dayEvents.length > 8 && (
                <div
                  style={{ fontSize: "0.6rem", color: "var(--text-dim)", padding: "1px 3px" }}
                >
                  +{dayEvents.length - 8} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
