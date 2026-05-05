"use client";

import type { CalEvent } from "@/lib/calendar";
import { format, parseISO } from "date-fns";

const HOUR_START = 6;
const HOUR_END = 22; // exclusive
const TOTAL_HOURS = HOUR_END - HOUR_START;

interface Props {
  dateISO: string; // yyyy-MM-dd
  events: CalEvent[];
  onBack: () => void;
}

interface Positioned {
  event: CalEvent;
  top: number; // percent
  height: number; // percent
}

function positionEvents(events: CalEvent[], date: string): Positioned[] {
  const dayStart = new Date(`${date}T${String(HOUR_START).padStart(2, "0")}:00:00`);
  const dayEnd = new Date(`${date}T${String(HOUR_END).padStart(2, "0")}:00:00`);
  const totalMs = dayEnd.getTime() - dayStart.getTime();

  return events
    .filter((e) => {
      if (e.allDay) return false;
      const s = new Date(e.start);
      const en = new Date(e.end);
      const ds = new Date(date + "T00:00:00");
      const de = new Date(date + "T23:59:59");
      return s <= de && en >= ds;
    })
    .map((e) => {
      const eStart = new Date(e.start);
      const eEnd = new Date(e.end);
      const clampedStart = eStart < dayStart ? dayStart : eStart;
      const clampedEnd = eEnd > dayEnd ? dayEnd : eEnd;
      const top =
        ((clampedStart.getTime() - dayStart.getTime()) / totalMs) * 100;
      const height =
        ((clampedEnd.getTime() - clampedStart.getTime()) / totalMs) * 100;
      return { event: e, top, height: Math.max(height, 2) };
    });
}

function allDayEvents(events: CalEvent[], date: string): CalEvent[] {
  return events.filter((e) => {
    if (!e.allDay) return false;
    const s = new Date(e.start);
    const en = new Date(e.end);
    const ds = new Date(date + "T00:00:00");
    const de = new Date(date + "T23:59:59");
    return s <= de && en >= ds;
  });
}

function fmt12(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = d.getHours() >= 12 ? "PM" : "AM";
  return d.getMinutes() === 0 ? `${h} ${ap}` : `${h}:${m} ${ap}`;
}

export default function DayView({ dateISO, events, onBack }: Props) {
  const label = format(parseISO(dateISO), "EEEE, MMMM d");
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);
  const positioned = positionEvents(events, dateISO);
  const allDay = allDayEvents(events, dateISO);

  return (
    <div
      className="flex flex-col"
      style={{ height: "100vh", width: "100vw", background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-4"
        style={{
          height: "48px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          onPointerDown={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent-google)",
            fontSize: "1rem",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "none",
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{label}</span>
      </div>

      {/* All-day events */}
      {allDay.length > 0 && (
        <div
          className="flex flex-wrap gap-1 px-3 py-1"
          style={{
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {allDay.map((e) => (
            <div
              key={e.id}
              style={{
                background: e.color + "33",
                borderLeft: `2px solid ${e.color}`,
                borderRadius: "2px",
                padding: "2px 6px",
                fontSize: "0.75rem",
                color: "var(--text)",
              }}
            >
              {e.title}
            </div>
          ))}
        </div>
      )}

      {/* Hourly timeline */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Hour lines + labels */}
        {hours.map((h) => {
          const pct = ((h - HOUR_START) / TOTAL_HOURS) * 100;
          const label =
            h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
          return (
            <div
              key={h}
              style={{
                position: "absolute",
                top: `${pct}%`,
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  width: "52px",
                  fontSize: "0.65rem",
                  color: "var(--text-dim)",
                  textAlign: "right",
                  paddingRight: "8px",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "var(--border)",
                  marginTop: "0.4em",
                }}
              />
            </div>
          );
        })}

        {/* Event blocks */}
        {positioned.map(({ event, top, height }) => (
          <div
            key={event.id}
            style={{
              position: "absolute",
              top: `${top}%`,
              height: `${height}%`,
              left: "60px",
              right: "8px",
              background: event.color + "33",
              borderLeft: `3px solid ${event.color}`,
              borderRadius: "3px",
              padding: "2px 6px",
              overflow: "hidden",
              minHeight: "18px",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text)" }}>
              {event.title}
            </div>
            {height > 4 && (
              <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>
                {fmt12(event.start)} – {fmt12(event.end)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
