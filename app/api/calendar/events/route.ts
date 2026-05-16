import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/calendar";
import { startOfWeek, addWeeks } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const fetchEnd = addWeeks(weekStart, 3);
  try {
    const events = await getCalendarEvents(weekStart, fetchEnd);
    return NextResponse.json(events, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
