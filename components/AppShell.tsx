"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, useAppState, useNow } from "@/lib/client";
import { dayKey } from "@/lib/dates";
import { computeDisplay } from "@/lib/display";
import { specialDateOn } from "@/lib/events";
import type { AppState, SpecialDate } from "@/lib/types";
import TabBar, { type Tab } from "./TabBar";
import TodayView from "./TodayView";
import CalendarView from "./CalendarView";
import WeatherView from "./WeatherView";
import ListsView from "./ListsView";
import PhotoSlideshow from "./PhotoSlideshow";
import NightClock from "./NightClock";
import SpecialOverlay from "./SpecialOverlay";
import SyncPanel from "./SyncPanel";

const PHOTO_MODE_KEY = "home-display:photos";
const HEARTBEAT_MS = 60_000;

export default function AppShell({ initial }: { initial: AppState }) {
  const { state, setState, refresh, online } = useAppState(initial);
  const { settings } = state;
  const now = useNow(1000);
  const nowDate = now ?? new Date(state.serverTime);
  const today = dayKey(nowDate, settings.tz);

  const [tab, setTab] = useState<Tab>("today");
  const [calDay, setCalDay] = useState<string | null>(null);
  const [photos, setPhotos] = useState(false);
  const [special, setSpecial] = useState<{ date: SpecialDate; then: string } | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [localWake, setLocalWake] = useState<number | null>(null);
  const lastTouch = useRef(Date.now());
  const swallowClick = useRef(false);

  // Slideshow survives the reload that follows a deploy.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PHOTO_MODE_KEY) === "1") setPhotos(true);
    } catch {}
  }, []);
  const setPhotoMode = useCallback((on: boolean) => {
    setPhotos(on);
    try {
      if (on) sessionStorage.setItem(PHOTO_MODE_KEY, "1");
      else sessionStorage.removeItem(PHOTO_MODE_KEY);
    } catch {}
  }, []);

  // Heartbeat so the Pi agent can restart a hung browser.
  useEffect(() => {
    const beat = () => void api("/api/display/heartbeat", "POST").catch(() => {});
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  const wakeUntil = Math.max(state.display.wakeUntil ?? 0, localWake ?? 0) || null;
  const display = computeDisplay(settings, nowDate, wakeUntil);
  const asleep = display.mode !== "day";

  // Idle machine: back to Today, then the slideshow.
  useEffect(() => {
    if (!now || asleep) return;
    const idleMin = (now.getTime() - lastTouch.current) / 60_000;
    const hasPhotos = (state.photos?.assets.length ?? 0) > 0;
    if (settings.idleSlideshowMin > 0 && idleMin >= settings.idleSlideshowMin && hasPhotos && !photos) {
      setPhotoMode(true);
    }
    if (settings.idleReturnMin > 0 && idleMin >= settings.idleReturnMin) {
      if (tab !== "today") setTab("today");
      if (calDay) setCalDay(null);
      if (syncOpen) setSyncOpen(false);
      if (special) setSpecial(null);
    }
  }, [now, asleep, settings.idleSlideshowMin, settings.idleReturnMin, state.photos, photos, tab, calDay, syncOpen, special, setPhotoMode]);

  const onTouch = (e: React.PointerEvent) => {
    lastTouch.current = Date.now();
    if (asleep) {
      // First touch at night only wakes the screen; it never presses a button.
      e.stopPropagation();
      e.preventDefault();
      swallowClick.current = true;
      setLocalWake(Date.now() + settings.night.wakeMinutes * 60_000);
      void api("/api/display/wake", "POST").catch(() => {});
    }
  };

  const openDay = (key: string) => {
    const sd = specialDateOn(key, settings);
    setTab("calendar");
    if (sd?.title) setSpecial({ date: sd, then: key });
    else setCalDay(key);
  };

  return (
    <div
      className="kiosk"
      onPointerDownCapture={onTouch}
      onClickCapture={(e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <main className="kiosk-main">
        {tab === "today" && (
          <TodayView state={state} now={nowDate} today={today} onOpenDay={openDay} onOpenTab={setTab} />
        )}
        {tab === "calendar" && (
          <CalendarView state={state} today={today} day={calDay} onDay={setCalDay} onOpenDay={openDay} />
        )}
        {tab === "weather" && <WeatherView state={state} today={today} />}
        {tab === "lists" && <ListsView state={state} setState={setState} refresh={refresh} />}
      </main>
      <TabBar
        tab={tab}
        onTab={(t) => {
          if (t === "photos") return setPhotoMode(true);
          setTab(t);
          if (t === "calendar") setCalDay(null);
        }}
        now={now}
        tz={settings.tz}
        sync={state.sync}
        online={online}
        onSync={() => setSyncOpen(true)}
      />

      {syncOpen && <SyncPanel state={state} online={online} onClose={() => setSyncOpen(false)} />}
      {photos && (
        <PhotoSlideshow
          assets={state.photos?.assets ?? []}
          intervalMs={settings.photoIntervalSec * 1000}
          state={state}
          now={nowDate}
          onExit={() => {
            setPhotoMode(false);
            setTab("today");
          }}
        />
      )}
      {special && (
        <SpecialOverlay
          special={special.date}
          onDismiss={() => {
            setCalDay(special.then);
            setSpecial(null);
          }}
        />
      )}
      {asleep && <NightClock now={nowDate} tz={settings.tz} off={display.mode === "off"} />}
    </div>
  );
}
