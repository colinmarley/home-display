"use client";

import { useEffect, useState } from "react";
import type { CalEvent } from "@/lib/calendar";
import type { DayForecast } from "@/lib/weather";
import ClockDate from "./ClockDate";
import WeatherStrip from "./WeatherStrip";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import DayView from "./DayView";
import PhotoSlideshow from "./PhotoSlideshow";

interface Props {
  events: CalEvent[];
  forecast: DayForecast[];
  photoIntervalMs: number;
}

export default function DashboardClient({
  events,
  forecast,
  photoIntervalMs,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [calView, setCalView] = useState<"week" | "month">("week");

  // Auto-reload to pick up fresh calendar/weather data
  useEffect(() => {
    const id = setInterval(() => window.location.reload(), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (showPhotos) {
    return (
      <PhotoSlideshow
        photoIntervalMs={photoIntervalMs}
        onWake={() => setShowPhotos(false)}
      />
    );
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
          width: "150px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "10px 10px",
          gap: "10px",
          borderRight: "1px solid var(--border)",
        }}
      >
        <ClockDate />
        <div style={{ height: "1px", background: "var(--border)" }} />
        <WeatherStrip forecast={forecast} />
        <div style={{ height: "1px", background: "var(--border)" }} />
        {/* Calendar view toggle */}
        <div style={{ display: "flex", gap: "4px" }}>
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onPointerDown={() => setCalView(v)}
              style={{
                flex: 1,
                background: calView === v ? "var(--accent-google)" : "none",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: calView === v ? "#fff" : "var(--text-dim)",
                fontSize: "0.7rem",
                padding: "5px 4px",
                cursor: "none",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ height: "1px", background: "var(--border)" }} />
        {/* Photos toggle */}
        <button
          onPointerDown={() => setShowPhotos(true)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-dim)",
            fontSize: "0.75rem",
            padding: "6px 8px",
            textAlign: "left",
            cursor: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "1rem" }}>🖼️</span>
          Photos
        </button>
      </aside>

      {/* Calendar */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {calView === "week" ? (
          <WeekView events={events} onDaySelect={setSelectedDay} />
        ) : (
          <MonthView events={events} onDaySelect={setSelectedDay} />
        )}
      </div>
    </main>
  );
}
