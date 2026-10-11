import { describe, it, expect } from "vitest";
import { calendarWindow, syncCalendar } from "@/lib/sync/calendar";
import { groupNwsPeriods } from "@/lib/sync/weather";
import { computeDisplay } from "@/lib/display";
import type { CalEvent, Settings } from "@/lib/types";

const TZ = "America/Los_Angeles";

const ev = (id: string, cal: string): CalEvent => ({
  id,
  title: id,
  calendarId: cal,
  calendarName: cal,
  color: "#000",
  allDay: true,
  start: "2026-10-12",
  end: "2026-10-13",
});

const source = (key: string, result: () => Promise<CalEvent[]>) => ({
  key,
  run: async () => ({
    key,
    calendars: [{ id: key, name: key, color: "#000", source: "ics" as const }],
    events: await result(),
  }),
});

describe("syncCalendar", () => {
  const now = new Date("2026-10-12T01:30:00Z"); // Sunday 6:30 pm Pacific

  it("keeps a failing source's previous events and reports a warning", async () => {
    const first = await syncCalendar(TZ, null, [
      source("google", async () => [ev("g1", "google")]),
      source("icloud", async () => [ev("a1", "icloud")]),
    ], now);
    expect(first.warning).toBeNull();

    const second = await syncCalendar(TZ, first.payload, [
      source("google", async () => [ev("g2", "google")]),
      source("icloud", async () => {
        throw new Error("503 Service Unavailable");
      }),
    ], now);
    expect(second.payload.events.map((e) => e.id).sort()).toEqual(["a1", "g2"]);
    expect(second.warning).toContain("icloud: 503");
    expect(second.payload.sources.find((s) => s.key === "icloud")).toMatchObject({ ok: false, eventCount: 1 });
  });

  it("throws only when no source has ever produced data", async () => {
    await expect(
      syncCalendar(TZ, null, [source("icloud", async () => { throw new Error("down"); })], now)
    ).rejects.toThrow("down");
  });

  it("computes the window in the display zone, not UTC", () => {
    const w = calendarWindow(now, TZ);
    expect(w.startKey).toBe("2026-09-27"); // Sunday Oct 11 − 14 days
    expect(w.start.toISOString()).toBe("2026-09-27T07:00:00.000Z");
  });
});

describe("groupNwsPeriods", () => {
  it("leaves the high empty when only tonight remains, and pairs later days correctly", () => {
    const days = groupNwsPeriods(
      [
        { startTime: "2026-10-11T18:00:00-07:00", endTime: "", isDaytime: false, temperature: 54, shortForecast: "Mostly Clear" },
        { startTime: "2026-10-12T06:00:00-07:00", endTime: "", isDaytime: true, temperature: 78, shortForecast: "Sunny", probabilityOfPrecipitation: { value: 0 } },
        { startTime: "2026-10-12T18:00:00-07:00", endTime: "", isDaytime: false, temperature: 55, shortForecast: "Chance Rain Showers", probabilityOfPrecipitation: { value: 30 } },
      ],
      TZ
    );
    expect(days[0]).toMatchObject({ date: "2026-10-11", tempMax: null, tempMin: 54, weatherCode: 1 });
    expect(days[1]).toMatchObject({ date: "2026-10-12", tempMax: 78, tempMin: 55, weatherCode: 0, precipProbMax: 30 });
  });
});

describe("computeDisplay", () => {
  const settings = {
    tz: TZ,
    night: { enabled: true, start: "22:00", end: "06:30", offStart: "23:30", dayBrightness: 100, nightBrightness: 15, wakeMinutes: 5 },
  } as Settings;

  it("follows the schedule in the display zone and honors a touch wake", () => {
    expect(computeDisplay(settings, new Date("2026-10-12T04:00:00Z"), null).mode).toBe("day"); // 9 pm
    expect(computeDisplay(settings, new Date("2026-10-12T05:15:00Z"), null)).toMatchObject({ mode: "dim", brightness: 15 }); // 10:15 pm
    expect(computeDisplay(settings, new Date("2026-10-12T09:00:00Z"), null)).toMatchObject({ mode: "off", brightness: 0 }); // 2 am
    const t = new Date("2026-10-12T09:00:00Z");
    expect(computeDisplay(settings, t, t.getTime() + 60_000).mode).toBe("day");
    expect(computeDisplay(settings, new Date("2026-10-12T14:00:00Z"), null).mode).toBe("day"); // 7 am
  });
});
