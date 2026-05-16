import { getCalendarEvents } from "@/lib/calendar";
import { getWeatherData } from "@/lib/weather";
import DashboardClient from "@/components/DashboardClient";
import { startOfWeek, addWeeks } from "date-fns";

export const revalidate = 60; // 1-min server-side cache — client polls for fresher data

export default async function Home() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const fetchEnd = addWeeks(weekStart, 3);

  const [events, weatherData] = await Promise.all([
    getCalendarEvents(weekStart, fetchEnd).catch(() => []),
    getWeatherData().catch(() => ({ current: null, forecast: [] })),
  ]);

  const photoIntervalMs =
    Number(process.env.PHOTO_INTERVAL_SECONDS ?? 30) * 1000;

  return (
    <DashboardClient
      events={events}
      weatherData={weatherData}
      photoIntervalMs={photoIntervalMs}
    />
  );
}
