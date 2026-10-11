"use client";

import { useEffect, useRef } from "react";
import { addDaysKey, formatTime, minutesOfDay, startOfDay } from "@/lib/dates";
import { eventsOn } from "@/lib/events";
import type { CalEvent } from "@/lib/types";

const HOUR_PX = 52;
const LABEL_W = 56;

interface Props {
  day: string;
  events: CalEvent[];
  tz: string;
  isToday: boolean;
}

interface Placed {
  e: CalEvent;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** Lay out overlapping timed events side by side. */
function place(events: CalEvent[], day: string, tz: string): Placed[] {
  const dayStart = startOfDay(day, tz).getTime();
  const dayEnd = startOfDay(addDaysKey(day, 1), tz).getTime();
  const pxPerMs = HOUR_PX / 3_600_000;
  const items = events.map((e) => {
    const s = Math.max(new Date(e.start).getTime(), dayStart);
    const en = Math.min(Math.max(new Date(e.end).getTime(), s + 15 * 60_000), dayEnd);
    return { e, s, en, top: (s - dayStart) * pxPerMs, height: Math.max((en - s) * pxPerMs, 22), col: 0, cols: 1 };
  });
  items.sort((a, b) => a.s - b.s || b.en - a.en);

  // Group into clusters of transitively-overlapping events, assign columns greedily.
  let cluster: typeof items = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) c.cols = cols;
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.en > it.s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.en);
  }
  if (cluster.length) flush();
  return items;
}

export default function DayView({ day, events, tz, isToday }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayEvents = eventsOn(events, day, tz);
  const allDay = dayEvents.filter((e) => e.allDay);
  const placed = place(dayEvents.filter((e) => !e.allDay), day, tz);
  const nowMin = isToday ? minutesOfDay(new Date(), tz) : null;

  // Open scrolled to now (today) or to the first event / 8 am.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstTop = placed.length ? Math.min(...placed.map((p) => p.top)) : 8 * HOUR_PX;
    const target = nowMin !== null ? (nowMin / 60 - 1) * HOUR_PX : firstTop - 20;
    el.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {allDay.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {allDay.map((e) => (
            <div key={e.id} className="event-pill" style={{ background: e.color + "44", borderLeft: `3px solid ${e.color}` }}>
              {e.title}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="scroll-y" style={{ flex: 1 }}>
        <div style={{ position: "relative", height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} style={{ position: "absolute", top: h * HOUR_PX, left: 0, right: 0, display: "flex" }}>
              <span className="num" style={{ width: LABEL_W, textAlign: "right", paddingRight: 8, fontSize: "0.7rem", color: "var(--text-faint)", transform: "translateY(-0.5em)" }}>
                {h === 0 ? "" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
          ))}
          {placed.map(({ e, top, height, col, cols }) => (
            <div
              key={e.id}
              className="event-pill"
              style={{
                position: "absolute",
                top,
                height,
                left: `calc(${LABEL_W + 4}px + (100% - ${LABEL_W + 12}px) * ${col / cols})`,
                width: `calc((100% - ${LABEL_W + 12}px) / ${cols} - 3px)`,
                background: e.color + "33",
                borderLeft: `3px solid ${e.color}`,
              }}
            >
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              {height > 34 && (
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                  {formatTime(e.start, tz)} – {formatTime(e.end, tz)}
                  {e.location ? ` · ${e.location}` : ""}
                </div>
              )}
            </div>
          ))}
          {nowMin !== null && (
            <div style={{ position: "absolute", top: (nowMin / 60) * HOUR_PX, left: LABEL_W - 4, right: 0, height: 2, background: "var(--danger)" }}>
              <span style={{ position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: 999, background: "var(--danger)" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
