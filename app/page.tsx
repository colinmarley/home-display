import { getCalendarEvents } from "@/lib/calendar";
import { getWeekForecast } from "@/lib/weather";
import DashboardClient from "@/components/DashboardClient";
import { startOfWeek, addWeeks } from "date-fns";

export const revalidate = 900; // 15 min server-side cache

export default async function Home() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const fetchEnd = addWeeks(weekStart, 3);

  const [events, forecast] = await Promise.all([
    getCalendarEvents(weekStart, fetchEnd).catch(() => []),
    getWeekForecast().catch(() => []),
  ]);

  const idleTimeoutMs =
    Number(process.env.IDLE_TIMEOUT_MINUTES ?? 5) * 60 * 1000;
  const photoIntervalMs =
    Number(process.env.PHOTO_INTERVAL_SECONDS ?? 30) * 1000;

  return (
    <DashboardClient
      events={events}
      forecast={forecast}
      idleTimeoutMs={idleTimeoutMs}
      photoIntervalMs={photoIntervalMs}
    />
  );
}
