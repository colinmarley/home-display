"use client";

import { useEffect, useState } from "react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function ClockDate() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;

  return (
    <div className="flex flex-col gap-0.5">
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          color: "var(--text)",
          lineHeight: 1,
        }}
      >
        {h12}:{m}
        <span style={{ fontSize: "0.85rem", fontWeight: 400, marginLeft: "4px", color: "var(--text-dim)" }}>
          {ampm}
        </span>
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
        {DAY_NAMES[now.getDay()]}, {MONTH_NAMES[now.getMonth()]} {now.getDate()}
      </div>
    </div>
  );
}
