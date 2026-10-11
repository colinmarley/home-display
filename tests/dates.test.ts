import { describe, it, expect } from "vitest";
import { dayKey, startOfWeekKey, zonedTime, inWindow, parseHHMM, formatTime } from "@/lib/dates";

const TZ = "America/Los_Angeles";

describe("dates", () => {
  it("Sunday 5-11pm Pacific is still Sunday, and the week still starts the previous Monday", () => {
    // Sun Oct 11 2026 18:30 PDT = Mon Oct 12 01:30 UTC
    const now = new Date("2026-10-12T01:30:00Z");
    expect(dayKey(now, TZ)).toBe("2026-10-11");
    expect(startOfWeekKey(dayKey(now, TZ))).toBe("2026-10-05");
  });

  it("zonedTime resolves local wall-clock to the right instant across DST", () => {
    expect(zonedTime("2026-10-11", TZ, 0).toISOString()).toBe("2026-10-11T07:00:00.000Z");
    expect(zonedTime("2026-12-01", TZ, 0).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(zonedTime("2026-11-01", TZ, 12).toISOString()).toBe("2026-11-01T20:00:00.000Z");
  });

  it("night windows wrap midnight", () => {
    const [s, e] = [parseHHMM("22:00"), parseHHMM("06:30")];
    expect(inWindow(parseHHMM("23:15"), s, e)).toBe(true);
    expect(inWindow(parseHHMM("03:00"), s, e)).toBe(true);
    expect(inWindow(parseHHMM("06:30"), s, e)).toBe(false);
    expect(inWindow(parseHHMM("12:00"), s, e)).toBe(false);
  });

  it("formats times in the display zone", () => {
    expect(formatTime("2026-10-12T01:30:00Z", TZ)).toBe("6:30 PM");
    expect(formatTime("2026-10-12T01:00:00Z", TZ, true)).toBe("6p");
  });
});
