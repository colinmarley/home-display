"use client";

import { useEffect, useRef, useState } from "react";
import type { CalEvent } from "@/lib/calendar";
import type { DayForecast } from "@/lib/weather";
import ClockDate from "./ClockDate";
import WeatherStrip from "./WeatherStrip";
import WeekView from "./WeekView";
import DayView from "./DayView";
import PhotoSlideshow from "./PhotoSlideshow";

interface Props {
  events: CalEvent[];
  forecast: DayForecast[];
  idleTimeoutMs: number;
  photoIntervalMs: number;
}

export default function DashboardClient({
  events,
  forecast,
  idleTimeoutMs,
  photoIntervalMs,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdle = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIdle(true), idleTimeoutMs);
  };

  useEffect(() => {
    resetIdle();
    window.addEventListener("pointerdown", resetIdle);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("pointerdown", resetIdle);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-reload to pick up fresh calendar/weather data
  useEffect(() => {
    const id = setInterval(() => window.location.reload(), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const wakeFromIdle = () => {
    setIdle(false);
    resetIdle();
  };

  if (idle) {
    return <PhotoSlideshow photoIntervalMs={photoIntervalMs} onWake={wakeFromIdle} />;
  }

  if (selectedDay) {
    return (
      <DayView
        dateISO={selectedDay}
        events={events}
        onBack={() => setSelectedDay(null)}
      />
    );
  }

  return (
    <main
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Left sidebar */}
      <aside
        style={{
          width: "185px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "14px 12px",
          gap: "14px",
          borderRight: "1px solid var(--border)",
        }}
      >
        <ClockDate />
        <div style={{ height: "1px", background: "var(--border)" }} />
        <WeatherStrip forecast={forecast} />
      </aside>

      {/* Week calendar */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <WeekView events={events} onDaySelect={setSelectedDay} />
      </div>
    </main>
  );
}
