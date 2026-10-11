"use client";

import { addDaysKey, diffDaysKey, formatTime, longDateLabel, zonedParts } from "@/lib/dates";
import { eventsOn, relativeStart, specialDateOn, startsBefore, upcomingCountdowns } from "@/lib/events";
import type { AppState, CalEvent } from "@/lib/types";
import type { Tab } from "./TabBar";
import { AlertBanner, HourlyStrip, dayLabel, temp, weatherIcon } from "./weatherBits";
import { wmoToLabel } from "@/lib/wmo";

interface Props {
  state: AppState;
  now: Date;
  today: string;
  onOpenDay: (key: string) => void;
  onOpenTab: (t: Tab) => void;
}

function AgendaRow({ e, now, tz, day }: { e: CalEvent; now: Date; tz: string; day: string }) {
  const past = !e.allDay && new Date(e.end) <= now;
  const live = !e.allDay && new Date(e.start) <= now && new Date(e.end) > now;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch", opacity: past ? 0.45 : 1, padding: "5px 0" }}>
      <span style={{ width: 4, borderRadius: 2, background: e.color, flexShrink: 0 }} />
      <span className="num" style={{ width: 62, flexShrink: 0, color: "var(--text-dim)", fontSize: "0.82rem", paddingTop: 1 }}>
        {e.allDay ? "All day" : startsBefore(e, day, tz) ? "cont." : formatTime(e.start, tz)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {e.title}
        </span>
        {e.location && (
          <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {e.location}
          </span>
        )}
      </span>
      {live && <span className="label" style={{ color: "var(--ok)", alignSelf: "center" }}>now</span>}
    </div>
  );
}

export default function TodayView({ state, now, today, onOpenDay, onOpenTab }: Props) {
  const { settings, weather, calendar, lists } = state;
  const tz = settings.tz;
  const events = calendar?.events ?? [];
  const tomorrow = addDaysKey(today, 1);
  const todayEvents = eventsOn(events, today, tz);
  const tomorrowEvents = eventsOn(events, tomorrow, tz);
  const next = todayEvents.find((e) => !e.allDay && new Date(e.start) > now);
  const special = specialDateOn(today, settings);
  const countdowns = upcomingCountdowns(settings, today).slice(0, 2);
  const daily = (weather?.daily ?? []).filter((d) => d.date >= today);
  const todayWx = daily.find((d) => d.date === today);
  const p = zonedParts(now, tz);
  const h12 = p.hour % 12 || 12;
  const topList = lists.find((l) => l.items.some((i) => !i.done));

  return (
    <div style={{ display: "flex", height: "100%", gap: 14, padding: 14 }}>
      {/* Left column: time + weather */}
      <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div className="num" style={{ fontSize: "4.2rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {h12}:{String(p.minute).padStart(2, "0")}
            <span style={{ fontSize: "1.2rem", fontWeight: 400, color: "var(--text-dim)", marginLeft: 6 }}>
              {p.hour >= 12 ? "PM" : "AM"}
            </span>
          </div>
          <div style={{ fontSize: "1.05rem", color: "var(--text-dim)", marginTop: 2 }}>{longDateLabel(today)}</div>
          {(special || countdowns.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {special && (
                <button className="chip" onClick={() => onOpenDay(today)} style={{ color: "#ff8fb8", borderColor: "#ff8fb855" }}>
                  {special.emoji} {special.label}
                </button>
              )}
              {countdowns.map((c) => {
                const d = diffDaysKey(c.date, today);
                return (
                  <span key={c.id} className="chip">
                    {c.emoji} {c.title} · {d === 0 ? "today!" : d === 1 ? "tomorrow" : `${d} days`}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div role="button" className="card" onClick={() => onOpenTab("weather")} style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          {weather?.current ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "2.6rem", lineHeight: 1 }}>{weatherIcon(weather.current.weatherCode, weather.current.isDay)}</span>
                <div style={{ flex: 1 }}>
                  <div className="num" style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{weather.current.temperature}°</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                    {wmoToLabel(weather.current.weatherCode)} · feels {weather.current.apparentTemperature}°
                  </div>
                </div>
                {todayWx && (
                  <div className="num" style={{ textAlign: "right", fontSize: "0.85rem" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{temp(todayWx.tempMax)}</span>{" "}
                      <span style={{ color: "var(--text-dim)" }}>{temp(todayWx.tempMin)}</span>
                    </div>
                    {(todayWx.precipProbMax ?? 0) >= 20 && <div style={{ color: "var(--rain)" }}>💧{todayWx.precipProbMax}%</div>}
                    {todayWx.sunset && <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>🌇 {formatTime(todayWx.sunset, tz)}</div>}
                  </div>
                )}
              </div>
              <HourlyStrip hours={weather.hourly} tz={tz} count={6} now={now} />
              <div style={{ display: "flex", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                {daily.slice(1, 5).map((d) => (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span className="label">{dayLabel(d.date, today)}</span>
                    <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{weatherIcon(d.weatherCode)}</span>
                    <span className="num" style={{ fontSize: "0.85rem" }}>
                      <strong>{temp(d.tempMax)}</strong> <span style={{ color: "var(--text-dim)" }}>{temp(d.tempMin)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: "var(--text-dim)" }}>Weather not synced yet</div>
          )}
          {weather && <AlertBanner alerts={weather.alerts} />}
        </div>
      </div>

      {/* Right column: agenda + list */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div role="button" className="card scroll-y" onClick={() => onOpenDay(today)} style={{ flex: 1, padding: "10px 12px", minHeight: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="label">Today</span>
            {next && (
              <span style={{ fontSize: "0.78rem", color: "var(--accent)" }}>
                {next.title.length > 22 ? `${next.title.slice(0, 22)}…` : next.title} {relativeStart(next, now)}
              </span>
            )}
          </div>
          {todayEvents.length === 0 && <div style={{ color: "var(--text-dim)", padding: "6px 0" }}>Nothing scheduled</div>}
          {todayEvents.map((e) => (
            <AgendaRow key={e.id} e={e} now={now} tz={tz} day={today} />
          ))}
          <div className="label" style={{ marginTop: 10 }}>Tomorrow</div>
          {tomorrowEvents.length === 0 && <div style={{ color: "var(--text-dim)", padding: "6px 0" }}>Nothing scheduled</div>}
          {tomorrowEvents.map((e) => (
            <AgendaRow key={e.id} e={e} now={now} tz={tz} day={tomorrow} />
          ))}
        </div>

        {topList && (
          <div role="button" className="card" onClick={() => onOpenTab("lists")} style={{ padding: "8px 12px", flexShrink: 0 }}>
            <div className="label">
              {topList.emoji} {topList.name} · {topList.items.filter((i) => !i.done).length} left
            </div>
            <div style={{ fontSize: "0.85rem", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {topList.items.filter((i) => !i.done).slice(0, 6).map((i) => i.text).join(" · ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
