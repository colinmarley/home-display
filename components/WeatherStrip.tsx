import type { DayForecast } from "@/lib/weather";
import { wmoToEmoji, wmoToLabel } from "@/lib/wmo";

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return SHORT_DAY[d.getDay()];
}

export default function WeatherStrip({ forecast }: { forecast: DayForecast[] }) {
  if (!forecast.length) {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
        Weather unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {forecast.slice(0, 5).map((day) => (
        <div
          key={day.date}
          className="flex items-center gap-2"
          style={{ fontSize: "0.82rem" }}
        >
          <span style={{ width: "28px", color: "var(--text-dim)", flexShrink: 0 }}>
            {shortDay(day.date)}
          </span>
          <span style={{ fontSize: "1.1rem", lineHeight: 1, flexShrink: 0 }}>
            {wmoToEmoji(day.weatherCode)}
          </span>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            {day.tempMax}°
          </span>
          <span style={{ color: "var(--text-dim)" }}>{day.tempMin}°</span>
        </div>
      ))}
    </div>
  );
}
