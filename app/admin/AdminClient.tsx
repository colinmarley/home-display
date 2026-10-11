"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { AppState, Countdown, Settings, SpecialDate, WeatherSource } from "@/lib/types";

const SOURCE_NAMES: Record<string, string> = { calendar: "Calendars", weather: "Weather", photos: "Photos" };
const WEATHER_OPTIONS: { value: WeatherSource; label: string }[] = [
  { value: "open-meteo", label: "Open-Meteo (best match)" },
  { value: "open-meteo-gfs", label: "Open-Meteo · NOAA GFS" },
  { value: "open-meteo-ecmwf", label: "Open-Meteo · ECMWF" },
  { value: "nws", label: "National Weather Service" },
];

function ago(ts: number | null | undefined): string {
  if (!ts) return "never";
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

const newId = () => Math.random().toString(36).slice(2, 10);

interface CompareRow {
  source: string;
  label: string;
  error?: string;
  current?: { temperature: number } | null;
  daily?: { date: string; tempMax: number | null; tempMin: number | null; precipProbMax: number | null }[];
}

export default function AdminClient({ initial, pinConfigured }: { initial: AppState; pinConfigured: boolean }) {
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState<Settings>(initial.settings);
  const [saved, setSaved] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [compare, setCompare] = useState<CompareRow[] | null>(null);
  const [activeList, setActiveList] = useState<number | null>(initial.lists[0]?.id ?? null);
  const [newItem, setNewItem] = useState("");
  const [newList, setNewList] = useState({ name: "", emoji: "" });

  const reload = async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  };

  const save = async (patch: Partial<Settings>, label: string) => {
    const res = await api("/api/admin/settings", "PATCH", patch);
    if (res.ok) {
      const s = (await res.json()) as Settings;
      setDraft(s);
      setSaved(`${label} saved`);
      setTimeout(() => setSaved(""), 2500);
      void reload();
    } else setSaved(`Save failed (${res.status})`);
  };

  const syncNow = async (source: string) => {
    setBusy(source);
    await api("/api/admin/sync", "POST", { source });
    await reload();
    setBusy("");
  };

  const runCompare = async () => {
    setBusy("compare");
    const res = await fetch("/api/admin/weather-compare", { cache: "no-store" });
    if (res.ok) setCompare(await res.json());
    setBusy("");
  };

  const night = draft.night;
  const setNight = (p: Partial<Settings["night"]>) => setDraft({ ...draft, night: { ...night, ...p } });
  const list = state.lists.find((l) => l.id === activeList) ?? state.lists[0];

  const addItem = async () => {
    if (!list || !newItem.trim()) return;
    await api(`/api/lists/${list.id}/items`, "POST", { text: newItem });
    setNewItem("");
    await reload();
  };

  const updateSpecial = (id: string, p: Partial<SpecialDate>) =>
    setDraft({ ...draft, specialDates: draft.specialDates.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const updateCountdown = (id: string, p: Partial<Countdown>) =>
    setDraft({ ...draft, countdowns: draft.countdowns.map((c) => (c.id === id ? { ...c, ...p } : c)) });

  return (
    <div className="admin">
      <h1>🏠 Home Display settings</h1>
      {!pinConfigured && (
        <p className="muted">Tip: set ADMIN_PIN in the server .env to lock this page.</p>
      )}
      {saved && (
        <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", background: "var(--ok)", color: "#fff", padding: "6px 14px", borderRadius: 8, zIndex: 10 }}>
          {saved}
        </div>
      )}

      {/* ── Sync ── */}
      <section className="card">
        <h2>Sync status</h2>
        {state.sync.map((s) => (
          <div key={s.source} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{SOURCE_NAMES[s.source] ?? s.source}</strong>
              <span className="row">
                <span className="muted" style={{ color: s.stale ? "var(--warn)" : undefined }}>{ago(s.syncedAt)}</span>
                <button className="btn" disabled={busy === s.source} onClick={() => syncNow(s.source)}>
                  {busy === s.source ? "Syncing…" : "Sync now"}
                </button>
              </span>
            </div>
            {s.error && <div style={{ color: s.stale ? "var(--danger)" : "var(--warn)", fontSize: "0.85rem", marginTop: 4 }}>{s.error}</div>}
            {s.source === "calendar" &&
              state.calendar?.sources.map((c) => (
                <div key={c.key} className="muted" style={{ paddingLeft: 12 }}>
                  {c.ok ? "✅" : "⚠️"} {c.key}: {c.ok ? `${c.eventCount} events` : `${c.error} (keeping ${c.eventCount} events)`}
                </div>
              ))}
            {s.source === "photos" && state.photos && (
              <div className="muted" style={{ paddingLeft: 12 }}>
                “{state.photos.albumName}” · {state.photos.assets.length} photos · {state.photos.cached} cached locally
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Lists ── */}
      <section className="card">
        <h2>Lists</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          {state.lists.map((l) => (
            <button key={l.id} className={`btn ${l.id === list?.id ? "btn-primary" : ""}`} onClick={() => setActiveList(l.id)}>
              {l.emoji} {l.name}
            </button>
          ))}
        </div>
        {list && (
          <>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void addItem();
              }}
              style={{ marginBottom: 8 }}
            >
              <input style={{ flex: 1, minWidth: 180 }} placeholder={`Add to ${list.name}…`} value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
            {list.items.map((i) => (
              <div key={i.id} className="row" style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                <input
                  type="checkbox"
                  checked={i.done}
                  onChange={async () => {
                    await api(`/api/items/${i.id}`, "PATCH", { done: !i.done });
                    void reload();
                  }}
                />
                <span style={{ flex: 1, textDecoration: i.done ? "line-through" : "none", color: i.done ? "var(--text-dim)" : undefined }}>{i.text}</span>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await api(`/api/items/${i.id}`, "DELETE");
                    void reload();
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={async () => { await api(`/api/lists/${list.id}/clear-done`, "POST"); void reload(); }}>
                Clear done
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (list.items.length && !window.confirm(`Delete “${list.name}” and its ${list.items.length} items?`)) return;
                  await api(`/api/lists/${list.id}`, "DELETE");
                  setActiveList(null);
                  void reload();
                }}
              >
                Delete list
              </button>
            </div>
          </>
        )}
        <form
          className="row"
          style={{ marginTop: 14 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newList.name.trim()) return;
            await api("/api/lists", "POST", newList);
            setNewList({ name: "", emoji: "" });
            void reload();
          }}
        >
          <input style={{ width: 64 }} placeholder="🧺" value={newList.emoji} onChange={(e) => setNewList({ ...newList, emoji: e.target.value })} />
          <input style={{ flex: 1, minWidth: 140 }} placeholder="New list name" value={newList.name} onChange={(e) => setNewList({ ...newList, name: e.target.value })} />
          <button className="btn" type="submit">Create list</button>
        </form>
      </section>

      {/* ── Display ── */}
      <section className="card">
        <h2>Screen, idle & night mode</h2>
        <div className="row" style={{ gap: 16 }}>
          <label className="field">
            <span>Back to Today after (min idle, 0 = never)</span>
            <input type="number" min={0} value={draft.idleReturnMin} onChange={(e) => setDraft({ ...draft, idleReturnMin: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Start slideshow after (min idle, 0 = never)</span>
            <input type="number" min={0} value={draft.idleSlideshowMin} onChange={(e) => setDraft({ ...draft, idleSlideshowMin: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Seconds per photo</span>
            <input type="number" min={5} value={draft.photoIntervalSec} onChange={(e) => setDraft({ ...draft, photoIntervalSec: Number(e.target.value) })} />
          </label>
        </div>
        <label className="row" style={{ margin: "6px 0 10px" }}>
          <input type="checkbox" checked={night.enabled} onChange={(e) => setNight({ enabled: e.target.checked })} />
          <span>Night mode</span>
        </label>
        <div className="row" style={{ gap: 16 }}>
          <label className="field"><span>Dim from</span><input type="time" value={night.start} onChange={(e) => setNight({ start: e.target.value })} /></label>
          <label className="field"><span>Screen off from (optional)</span><input type="time" value={night.offStart} onChange={(e) => setNight({ offStart: e.target.value })} /></label>
          <label className="field"><span>Until</span><input type="time" value={night.end} onChange={(e) => setNight({ end: e.target.value })} /></label>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <label className="field"><span>Day brightness %</span><input type="number" min={5} max={100} value={night.dayBrightness} onChange={(e) => setNight({ dayBrightness: Number(e.target.value) })} /></label>
          <label className="field"><span>Night brightness %</span><input type="number" min={0} max={100} value={night.nightBrightness} onChange={(e) => setNight({ nightBrightness: Number(e.target.value) })} /></label>
          <label className="field"><span>Wake on touch for (min)</span><input type="number" min={1} value={night.wakeMinutes} onChange={(e) => setNight({ wakeMinutes: Number(e.target.value) })} /></label>
        </div>
        <button
          className="btn btn-primary"
          onClick={() =>
            save({ idleReturnMin: draft.idleReturnMin, idleSlideshowMin: draft.idleSlideshowMin, photoIntervalSec: draft.photoIntervalSec, night: draft.night }, "Screen settings")
          }
        >
          Save
        </button>
        <span className="muted" style={{ marginLeft: 10 }}>Now: {state.display.mode} at {state.display.brightness}%</span>
      </section>

      {/* ── Weather ── */}
      <section className="card">
        <h2>Weather</h2>
        <div className="row">
          <select value={draft.weatherSource} onChange={(e) => setDraft({ ...draft, weatherSource: e.target.value as WeatherSource })}>
            {WEATHER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => save({ weatherSource: draft.weatherSource }, "Weather source")}>Save</button>
          <button className="btn" disabled={busy === "compare"} onClick={runCompare}>{busy === "compare" ? "Comparing…" : "Compare sources"}</button>
        </div>
        {compare && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Now</th>
                  {compare.find((c) => c.daily)?.daily?.map((d) => <th key={d.date}>{d.date.slice(5)}</th>)}
                </tr>
              </thead>
              <tbody>
                {compare.map((c) => (
                  <tr key={c.source}>
                    <td>{c.label}</td>
                    {c.error ? (
                      <td colSpan={6} style={{ color: "var(--danger)" }}>{c.error}</td>
                    ) : (
                      <>
                        <td>{c.current?.temperature ?? "–"}°</td>
                        {c.daily?.map((d) => (
                          <td key={d.date}>
                            {d.tempMax ?? "–"}/{d.tempMin ?? "–"}
                            {(d.precipProbMax ?? 0) >= 20 ? ` 💧${d.precipProbMax}%` : ""}
                          </td>
                        ))}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">High/low °F. Pick the source that best matches what you actually see outside.</p>
          </div>
        )}
      </section>

      {/* ── Calendars ── */}
      <section className="card">
        <h2>Calendars</h2>
        {(state.calendar?.calendars ?? []).length === 0 && <p className="muted">No calendars synced yet.</p>}
        {(state.calendar?.calendars ?? []).map((c) => {
          const o = draft.calendars[c.id] ?? {};
          const set = (p: { hidden?: boolean; color?: string }) =>
            setDraft({ ...draft, calendars: { ...draft.calendars, [c.id]: { ...o, ...p } } });
          return (
            <div key={c.id} className="row" style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}>
              <input type="checkbox" checked={!o.hidden} onChange={(e) => set({ hidden: !e.target.checked })} />
              <input type="color" value={o.color || c.color} onChange={(e) => set({ color: e.target.value })} />
              <span style={{ flex: 1 }}>{c.name}</span>
              <span className="muted">{c.source}</span>
            </div>
          );
        })}
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => save({ calendars: draft.calendars }, "Calendars")}>Save</button>
      </section>

      {/* ── Special dates ── */}
      <section className="card">
        <h2>Special dates</h2>
        <p className="muted">Highlighted on the calendar every year. With a title, tapping the day shows a full-screen surprise.</p>
        {draft.specialDates.map((s) => (
          <div key={s.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
            <div className="row">
              <input type="number" min={1} max={12} style={{ width: 64 }} value={s.month} onChange={(e) => updateSpecial(s.id, { month: Number(e.target.value) })} aria-label="Month" />
              <span>/</span>
              <input type="number" min={1} max={31} style={{ width: 64 }} value={s.day} onChange={(e) => updateSpecial(s.id, { day: Number(e.target.value) })} aria-label="Day" />
              <input style={{ width: 56 }} value={s.emoji} onChange={(e) => updateSpecial(s.id, { emoji: e.target.value })} aria-label="Emoji" />
              <input style={{ flex: 1, minWidth: 140 }} value={s.label} placeholder="Label" onChange={(e) => updateSpecial(s.id, { label: e.target.value })} />
              <select value={s.theme} onChange={(e) => updateSpecial(s.id, { theme: e.target.value as SpecialDate["theme"] })}>
                <option value="pink">Pink</option>
                <option value="gold">Gold</option>
                <option value="blue">Blue</option>
              </select>
              <button className="btn btn-danger" onClick={() => setDraft({ ...draft, specialDates: draft.specialDates.filter((x) => x.id !== s.id) })}>✕</button>
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              <span>Surprise title (blank = no surprise)</span>
              <textarea rows={2} value={s.title} onChange={(e) => updateSpecial(s.id, { title: e.target.value })} />
            </label>
            <label className="field"><span>Message</span><textarea rows={4} value={s.message} onChange={(e) => updateSpecial(s.id, { message: e.target.value })} /></label>
            <label className="field"><span>Sign-off</span><input value={s.signoff} onChange={(e) => updateSpecial(s.id, { signoff: e.target.value })} /></label>
          </div>
        ))}
        <div className="row">
          <button
            className="btn"
            onClick={() =>
              setDraft({
                ...draft,
                specialDates: [...draft.specialDates, { id: newId(), month: 1, day: 1, label: "", emoji: "🎉", theme: "gold", title: "", message: "", signoff: "" }],
              })
            }
          >
            + Add date
          </button>
          <button className="btn btn-primary" onClick={() => save({ specialDates: draft.specialDates }, "Special dates")}>Save</button>
        </div>
      </section>

      {/* ── Countdowns ── */}
      <section className="card">
        <h2>Countdowns</h2>
        <p className="muted">Shown on the Today screen until the date passes.</p>
        {draft.countdowns.map((c) => (
          <div key={c.id} className="row" style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
            <input style={{ width: 56 }} value={c.emoji} onChange={(e) => updateCountdown(c.id, { emoji: e.target.value })} aria-label="Emoji" />
            <input style={{ flex: 1, minWidth: 140 }} value={c.title} placeholder="Vacation" onChange={(e) => updateCountdown(c.id, { title: e.target.value })} />
            <input type="date" value={c.date} onChange={(e) => updateCountdown(c.id, { date: e.target.value })} />
            <button className="btn btn-danger" onClick={() => setDraft({ ...draft, countdowns: draft.countdowns.filter((x) => x.id !== c.id) })}>✕</button>
          </div>
        ))}
        <div className="row">
          <button
            className="btn"
            onClick={() => setDraft({ ...draft, countdowns: [...draft.countdowns, { id: newId(), title: "", date: "", emoji: "⏳" }] })}
          >
            + Add countdown
          </button>
          <button
            className="btn btn-primary"
            onClick={() => save({ countdowns: draft.countdowns.filter((c) => c.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) }, "Countdowns")}
          >
            Save
          </button>
        </div>
      </section>

      <p className="muted">Timezone: {draft.tz} · version {state.version}</p>
    </div>
  );
}
