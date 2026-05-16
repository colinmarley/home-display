"use client";

import { useEffect, useState } from "react";
import type { CalEvent } from "@/lib/calendar";
import type { WeatherData } from "@/lib/weather";
import ClockDate from "./ClockDate";
import WeatherStrip from "./WeatherStrip";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import DayView from "./DayView";
import PhotoSlideshow from "./PhotoSlideshow";
import BirthdaySurprise from "./BirthdaySurprise";

const PHOTO_MODE_KEY = "home-display:show-photos";

function isBirthdayDate(dateISO: string): boolean {
  const d = new Date(dateISO + "T12:00:00");
  return d.getMonth() === 4 && d.getDate() === 16; // May 16
}

interface Props {
  events: CalEvent[];
  weatherData: WeatherData;
  photoIntervalMs: number;
}

export default function DashboardClient({
  events: initialEvents,
  weatherData: initialWeatherData,
  photoIntervalMs,
}: Props) {
  const [events, setEvents] = useState<CalEvent[]>(initialEvents);
  const [weatherData, setWeatherData] = useState<WeatherData>(initialWeatherData);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);
  const [calView, setCalView] = useState<"week" | "month">("week");

  useEffect(() => {
    const stored = sessionStorage.getItem(PHOTO_MODE_KEY);
    if (stored === "1") setShowPhotos(true);
  }, []);

  const setPhotoMode = (enabled: boolean) => {
    setShowPhotos(enabled);
    if (enabled) {
      sessionStorage.setItem(PHOTO_MODE_KEY, "1");
      return;
    }
    sessionStorage.removeItem(PHOTO_MODE_KEY);
  };

  // Poll calendar every 5 minutes for fresh events
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/calendar/events");
        if (res.ok) setEvents(await res.json());
      } catch {}
    };
    const id = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Poll weather every 20 minutes for updated conditions
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/weather");
        if (res.ok) setWeatherData(await res.json());
      } catch {}
    };
    const id = setInterval(poll, 20 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleDaySelect = (dateISO: string) => {
    if (isBirthdayDate(dateISO)) {
      setShowBirthday(true);
    } else {
      setSelectedDay(dateISO);
    }
  };

  if (showBirthday) {
    return (
      <BirthdaySurprise
        onDismiss={() => {
          setShowBirthday(false);
          setSelectedDay("2026-05-16");
        }}
      />
    );
  }

  if (showPhotos) {
    return (
      <PhotoSlideshow
        photoIntervalMs={photoIntervalMs}
        onWake={() => setPhotoMode(false)}
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
        <WeatherStrip weatherData={weatherData} />
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
          onPointerDown={() => setPhotoMode(true)}
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
          <WeekView events={events} onDaySelect={handleDaySelect} />
        ) : (
          <MonthView events={events} onDaySelect={handleDaySelect} />
        )}
      </div>
    </main>
  );
}
