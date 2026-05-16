import { NextResponse } from "next/server";
import { getWeatherData } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getWeatherData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { current: null, forecast: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
