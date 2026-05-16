import type { WeatherData } from "@/lib/weather";
import { wmoToEmoji } from "@/lib/wmo";

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return SHORT_DAY[d.getDay()];
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

export default function WeatherStrip({ weatherData }: { weatherData: WeatherData }) {
  const { current, forecast } = weatherData;

  if (!forecast.length) {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
        Weather unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Current real-time conditions */}
      {current && (
        <div
          style={{
            background: "var(--accent-today)",
            borderRadius: "6px",
            padding: "6px 8px",
            marginBottom: "2px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>
            {wmoToEmoji(current.weatherCode)}
          </span>
          <div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--text)",
                lineHeight: 1,
              }}
            >
              {current.temperature}°
            </div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-dim)",
                lineHeight: 1.3,
              }}
            >
              feels {current.apparentTemperature}°
            </div>
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      {forecast.slice(0, 5).map((day) => {
        const today = isToday(day.date);
        return (
          <div
            key={day.date}
            className="flex items-center gap-2"
            style={{ fontSize: "0.82rem" }}
          >
            <span
              style={{
                width: "30px",
                color: today ? "var(--accent-google)" : "var(--text-dim)",
                fontWeight: today ? 700 : 400,
                flexShrink: 0,
                fontSize: today ? "0.74rem" : "0.82rem",
              }}
            >
              {today ? "Now" : shortDay(day.date)}
            </span>
            <span style={{ fontSize: "1.1rem", lineHeight: 1, flexShrink: 0 }}>
              {wmoToEmoji(day.weatherCode)}
            </span>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {day.tempMax}°
            </span>
            <span style={{ color: "var(--text-dim)" }}>{day.tempMin}°</span>
          </div>
        );
      })}
    </div>
  );
}
