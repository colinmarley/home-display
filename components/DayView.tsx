"use client";

import { useEffect, useRef } from "react";
import type { CalEvent } from "@/lib/calendar";
import { format, parseISO } from "date-fns";

const HOUR_START = 6;
const HOUR_END = 22; // exclusive

function isBirthdayDate(dateISO: string): boolean {
  const d = new Date(dateISO + "T12:00:00");
  return d.getMonth() === 4 && d.getDate() === 16; // May 16
}
const TOTAL_HOURS = HOUR_END - HOUR_START;
// 52px per hour → 16 hours = 832px total; comfortably scrollable on 480px screen
const HOUR_HEIGHT_PX = 52;
const MS_PER_PX = HOUR_HEIGHT_PX / (60 * 60 * 1000);

interface Props {
  dateISO: string; // yyyy-MM-dd
  events: CalEvent[];
  onBack: () => void;
}

interface Positioned {
  event: CalEvent;
  topPx: number;
  heightPx: number;
}

function positionEvents(events: CalEvent[], date: string): Positioned[] {
  const dayStart = new Date(`${date}T${String(HOUR_START).padStart(2, "0")}:00:00`);
  const dayEnd = new Date(`${date}T${String(HOUR_END).padStart(2, "0")}:00:00`);

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
      const topPx = (clampedStart.getTime() - dayStart.getTime()) * MS_PER_PX;
      const heightPx = Math.max(
        (clampedEnd.getTime() - clampedStart.getTime()) * MS_PER_PX,
        24
      );
      return { event: e, topPx, heightPx };
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to 8am (2 hours past start) when opening
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (8 - HOUR_START) * HOUR_HEIGHT_PX - 16);
    }
  }, [dateISO]);

  const birthday = isBirthdayDate(dateISO);

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
          background: birthday ? "rgba(255,182,193,0.45)" : undefined,
        }}
      >
        <button
          onPointerDown={onBack}
          style={{
            background: "none",
            border: "none",
            color: birthday ? "#c2185b" : "var(--accent-google)",
            fontSize: "1rem",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "none",
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{label}</span>
        {birthday && (
          <span style={{ fontSize: "0.85rem", color: "#c2185b", fontWeight: 600 }}>
            🌸 Christine&apos;s Birthday 🌸
          </span>
        )}
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
                fontSize: "0.8rem",
                color: "var(--text)",
              }}
            >
              {e.title}
            </div>
          ))}
        </div>
      )}

      {/* Hourly timeline — scrollable */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ position: "relative", height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px` }}>
          {/* Hour lines + labels */}
          {hours.map((h) => {
            const topPx = (h - HOUR_START) * HOUR_HEIGHT_PX;
            const hourLabel =
              h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
            return (
              <div
                key={h}
                style={{
                  position: "absolute",
                  top: `${topPx}px`,
                  left: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: "52px",
                    fontSize: "0.7rem",
                    color: "var(--text-dim)",
                    textAlign: "right",
                    paddingRight: "8px",
                    paddingTop: "2px",
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {hourLabel}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: "var(--border)",
                    marginTop: "0.55em",
                  }}
                />
              </div>
            );
          })}

          {/* Event blocks */}
          {positioned.map(({ event, topPx, heightPx }) => (
            <div
              key={event.id}
              style={{
                position: "absolute",
                top: `${topPx}px`,
                height: `${heightPx}px`,
                left: "60px",
                right: "8px",
                background: event.color + "33",
                borderLeft: `3px solid ${event.color}`,
                borderRadius: "3px",
                padding: "2px 6px",
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>
                {event.title}
              </div>
              {heightPx > 32 && (
                <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>
                  {fmt12(event.start)} – {fmt12(event.end)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
