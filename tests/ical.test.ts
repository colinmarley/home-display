import { describe, it, expect } from "vitest";
import { expandIcs } from "@/lib/ical";
import { startOfDay } from "@/lib/dates";

const TZ = "America/Los_Angeles";
const VTZ = `BEGIN:VTIMEZONE
TZID:America/Los_Angeles
BEGIN:DAYLIGHT
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
TZNAME:PDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
TZNAME:PST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`;

const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:test\r\n${VTZ}\r\n${body}\r\nEND:VCALENDAR`.replace(/\r?\n/g, "\r\n");

function expand(ics: string, from: string, to: string) {
  return expandIcs(ics, startOfDay(from, TZ), startOfDay(to, TZ), from, to);
}

describe("expandIcs", () => {
  it("expands a weekly series that started long before the window, honoring EXDATE and a moved instance", () => {
    const ics = cal(`BEGIN:VEVENT
UID:weekly-1
DTSTART;TZID=America/Los_Angeles:20240104T180000
DTEND;TZID=America/Los_Angeles:20240104T190000
RRULE:FREQ=WEEKLY;BYDAY=TH
EXDATE;TZID=America/Los_Angeles:20261015T180000
SUMMARY:Small group
END:VEVENT
BEGIN:VEVENT
UID:weekly-1
RECURRENCE-ID;TZID=America/Los_Angeles:20261022T180000
DTSTART;TZID=America/Los_Angeles:20261023T190000
DTEND;TZID=America/Los_Angeles:20261023T200000
SUMMARY:Small group (moved)
END:VEVENT`);
    const occ = expand(ics, "2026-10-05", "2026-11-02");
    const starts = occ.map((o) => `${o.title}@${o.start}`).sort();
    expect(starts).toEqual([
      "Small group (moved)@2026-10-24T02:00:00.000Z", // Fri 7pm PDT
      "Small group@2026-10-09T01:00:00.000Z", // Thu Oct 8 6pm PDT
      "Small group@2026-10-30T01:00:00.000Z", // Thu Oct 29 6pm PDT
    ]);
  });

  it("keeps all-day events as plain dates (no previous-day shift)", () => {
    const ics = cal(`BEGIN:VEVENT
UID:allday-1
DTSTART;VALUE=DATE:20261012
DTEND;VALUE=DATE:20261014
SUMMARY:Trip
END:VEVENT
BEGIN:VEVENT
UID:allday-2
DTSTART;VALUE=DATE:20261016
SUMMARY:No end
END:VEVENT`);
    const occ = expand(ics, "2026-10-05", "2026-10-19");
    expect(occ.find((o) => o.uid === "allday-1")).toMatchObject({ allDay: true, start: "2026-10-12", end: "2026-10-14" });
    expect(occ.find((o) => o.uid === "allday-2")).toMatchObject({ start: "2026-10-16", end: "2026-10-17" });
  });

  it("keeps wall-clock time across the DST change", () => {
    const ics = cal(`BEGIN:VEVENT
UID:dst
DTSTART;TZID=America/Los_Angeles:20261026T090000
DTEND;TZID=America/Los_Angeles:20261026T100000
RRULE:FREQ=DAILY;COUNT=14
SUMMARY:Standup
END:VEVENT`);
    const occ = expand(ics, "2026-10-30", "2026-11-03");
    expect(occ.map((o) => o.start)).toEqual([
      "2026-10-30T16:00:00.000Z",
      "2026-10-31T16:00:00.000Z",
      "2026-11-01T17:00:00.000Z", // PST now
      "2026-11-02T17:00:00.000Z",
    ]);
  });

  it("drops cancelled instances and a weekly all-day series expands", () => {
    const ics = cal(`BEGIN:VEVENT
UID:trash
DTSTART;VALUE=DATE:20250106
RRULE:FREQ=WEEKLY
SUMMARY:Trash day
END:VEVENT
BEGIN:VEVENT
UID:trash
RECURRENCE-ID;VALUE=DATE:20261012
DTSTART;VALUE=DATE:20261012
STATUS:CANCELLED
SUMMARY:Trash day
END:VEVENT`);
    const occ = expand(ics, "2026-10-05", "2026-10-26");
    expect(occ.map((o) => o.start).sort()).toEqual(["2026-10-05", "2026-10-19"]);
  });
});
