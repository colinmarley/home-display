"use client";

import { useState } from "react";
import { addDaysKey, keyParts, longDateLabel, monthName, startOfWeekKey } from "@/lib/dates";
import { specialDateOn } from "@/lib/events";
import type { AppState } from "@/lib/types";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import DayView from "./DayView";

interface Props {
  state: AppState;
  today: string;
  day: string | null;
  onDay: (key: string | null) => void;
  onOpenDay: (key: string) => void;
}

type Mode = "week" | "month";

function monthStart(key: string): string {
  const { year, month } = keyParts(key);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function shiftMonth(first: string, n: number): string {
  const { year, month } = keyParts(first);
  const m = year * 12 + (month - 1) + n;
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`;
}

export default function CalendarView({ state, today, day, onDay, onOpenDay }: Props) {
  const [mode, setMode] = useState<Mode>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(today));
  const [month, setMonth] = useState(() => monthStart(today));
  const { settings, calendar } = state;
  const events = calendar?.events ?? [];
  const tz = settings.tz;

  const atToday =
    day ? day === today : mode === "week" ? weekStart === startOfWeekKey(today) : month === monthStart(today);

  const step = (n: number) => {
    if (day) onDay(addDaysKey(day, n));
    else if (mode === "week") setWeekStart(addDaysKey(weekStart, 7 * n));
    else setMonth(shiftMonth(month, n));
  };
  const goToday = () => {
    if (day) onDay(today);
    setWeekStart(startOfWeekKey(today));
    setMonth(monthStart(today));
  };

  let title: string;
  if (day) title = longDateLabel(day);
  else if (mode === "month") title = `${monthName(keyParts(month).month)} ${keyParts(month).year}`;
  else {
    const end = addDaysKey(weekStart, 6);
    const a = keyParts(weekStart);
    const b = keyParts(end);
    title =
      a.month === b.month
        ? `${monthName(a.month)} ${a.day} – ${b.day}`
        : `${monthName(a.month, true)} ${a.day} – ${monthName(b.month, true)} ${b.day}`;
  }
  const special = day ? specialDateOn(day, settings) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {day ? (
          <button className="chip" onClick={() => onDay(null)}>← {mode === "week" ? "Week" : "Month"}</button>
        ) : (
          (["week", "month"] as const).map((m) => (
            <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)} style={{ textTransform: "capitalize" }}>
              {m}
            </button>
          ))
        )}
        <div style={{ flex: 1, textAlign: "center", fontWeight: 650, fontSize: "1.05rem" }}>
          {title}
          {special && <span style={{ color: "#ff8fb8", marginLeft: 8, fontSize: "0.9rem" }}>{special.emoji} {special.label}</span>}
        </div>
        <button className="chip" onClick={() => step(-1)} aria-label="Previous" style={{ width: 44, justifyContent: "center" }}>‹</button>
        <button className="chip" onClick={goToday} aria-pressed={atToday}>Today</button>
        <button className="chip" onClick={() => step(1)} aria-label="Next" style={{ width: 44, justifyContent: "center" }}>›</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {day ? (
          <DayView day={day} events={events} tz={tz} isToday={day === today} />
        ) : mode === "week" ? (
          <WeekView weekStart={weekStart} today={today} events={events} settings={settings} onDay={onOpenDay} />
        ) : (
          <MonthView month={month} today={today} events={events} settings={settings} onDay={onOpenDay} />
        )}
      </div>
    </div>
  );
}
