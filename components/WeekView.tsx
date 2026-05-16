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

function isBirthdayDate(d: Date): boolean {
  return d.getMonth() === 4 && d.getDate() === 16; // May 16
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
        const isBirthday = isBirthdayDate(day);
        const dayEvents = eventsForDay(events, day);

        return (
          <div
            key={i}
            className="flex flex-col flex-1"
            style={{
              borderRight: i < 6 ? "1px solid var(--border)" : undefined,
              background: isBirthday
                ? "rgba(255,182,193,0.55)"
                : isToday
                ? "var(--accent-today)"
                : undefined,
              minWidth: 0,
            }}
            onPointerDown={() => onDaySelect(format(day, "yyyy-MM-dd"))}
          >
            {/* Header */}
            <div
              className="flex flex-col items-center py-2"
              style={{
                borderBottom: `1px solid ${isBirthday ? "rgba(255,105,180,0.4)" : "var(--border)"}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isBirthday ? "#c2185b" : "var(--text-dim)",
                }}
              >
                {DAY_SHORT[i]}
              </span>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: isToday || isBirthday ? 700 : 400,
                  color: isBirthday
                    ? "#c2185b"
                    : isToday
                    ? "var(--accent-google)"
                    : "var(--text)",
                  lineHeight: 1.2,
                }}
              >
                {day.getDate()}
              </span>
              {isBirthday && (
                <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>🌸</span>
              )}
            </div>

            {/* Events */}
            <div
              className="flex flex-col gap-0.5 p-0.5"
              style={{ flex: 1, overflowY: "auto" }}
            >
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  style={{
                    background: e.color + "33",
                    borderLeft: `2px solid ${e.color}`,
                    borderRadius: "3px",
                    padding: "5px 5px",
                    fontSize: "0.82rem",
                    lineHeight: 1.25,
                    minHeight: "34px",
                    overflow: "hidden",
                    whiteSpace: "normal",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    color: "var(--text)",
                  }}
                  title={e.title}
                >
                  {!e.allDay && (
                    <span style={{ color: "var(--text-dim)", marginRight: "4px" }}>
                      {formatEventTime(e.start)}
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
