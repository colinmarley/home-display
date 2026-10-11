# Home Display

A self-hosted DakBoard replacement for a Raspberry Pi 4B + 7" official touchscreen. Boots directly into a full-screen kiosk display — no desktop, no cursor — showing:

- **Today screen** — big clock, current conditions, hourly forecast with rain chance, an "up next" agenda for today and tomorrow, countdowns, and a list preview
- **Calendar** — week / month / day views from Google Calendar (iCal feed) and iCloud (CalDAV), with recurring events fully expanded
- **Weather** — hourly + 7-day forecast, sunrise/sunset, UV, NWS alerts (Open-Meteo or weather.gov, free, no API key)
- **Lists** — shared grocery / chore / to-do lists, tap to check off on the display, add items from your phone
- **Photo slideshow** — from an Immich album, starts when idle, cached locally so it survives Immich outages
- **Night mode** — dims (or turns off) the backlight on a schedule; a touch wakes it
- **Settings page** — `/admin` on your phone: sync status, night schedule, calendars, weather source, special dates, countdowns

The display app (Next.js) runs in a Docker container on your server and is served over the LAN to the Pi. Updates are deployed to the server; the Pi never needs to be touched again.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  server (beelink) — /home/colin/code/home-display  →  port 3001            │
│                                                                             │
│  Background sync (instrumentation.ts → lib/sync/scheduler.ts)               │
│    calendar  every 5 min   Google ICS + iCloud CalDAV → expanded events    │
│    weather   every 15 min  Open-Meteo / NWS + NWS alerts                   │
│    photos    every 30 min  Immich album list + local image cache           │
│    → each success replaces the stored snapshot; a failure keeps the last   │
│      good data on screen and retries with backoff                          │
│                                                                             │
│  ./data/home-display.db (SQLite): snapshots, settings, lists               │
│  ./data/photo-cache/: preview-size album photos                            │
│                                                                             │
│  GET /api/state       everything the kiosk needs (read from the store)     │
│  /api/photo/proxy     cached photos     /admin   settings (phone)          │
│  /api/display/*       night schedule, wake, heartbeat (Pi agent)           │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ LAN  http://YOUR_SERVER_HOST:3001
┌────────────────────────────────────▼────────────────────────────────────────┐
│  Raspberry Pi 4B  +  Official 7" Touchscreen (800×480)                     │
│  Pi OS Lite 64-bit → auto-login → sway → kiosk-browser (Chromium loop)     │
│  home-display-agent.service: backlight schedule + browser watchdog         │
└─────────────────────────────────────────────────────────────────────────────┘
```

The kiosk polls `/api/state` every minute and never replaces good data with an
empty response. All dates are computed in `DISPLAY_TZ`, independent of the
container's or the Pi's clock zone.

---

## Prerequisites

| Item | Notes |
|------|-------|
| Raspberry Pi 4B (any RAM) | 2GB is fine for a kiosk display |
| Raspberry Pi 7" Official Touchscreen | 800×480, DSI connector |
| MicroSD card (16GB+, Class 10) | |
| Server on the same LAN | Any host reachable by the Pi on your local network |
| Docker + Docker Compose on the server | `docker --version` to verify |
| Immich instance | Reachable from the server over your local network |
| Google Calendar account | |
| Apple iCloud Calendar account | |

---

## Part 1 — Collect configuration values

Before deploying anything, gather all five values. Each takes about 2 minutes.

### 1.1 Google Calendar iCal URL

This is a private secret URL — do not share it.

1. Open [Google Calendar](https://calendar.google.com) on the web
2. Click the three-dot menu **⋮** next to the calendar you want (under "My calendars")
3. Click **Settings and sharing**
4. Scroll to **"Secret address in iCal format"**
5. Click the copy icon — it looks like:
   ```
   https://calendar.google.com/calendar/ical/YOUR_EMAIL%40gmail.com/private-XXXXX/basic.ics
   ```
6. Repeat for each additional calendar you want to include (add multiple `GOOGLE_ICAL_URL_2`, etc. — see [Adding multiple calendars](#adding-multiple-calendars))

### 1.2 iCloud calendars (CalDAV)

iCloud is read over CalDAV with an **app-specific password** — this sees every
calendar on the account and syncs reliably. (Published "public calendar" links
are still supported as a fallback via `APPLE_ICAL_URL`, but they frequently
return `503` or stop working entirely.)

1. Go to [account.apple.com](https://account.apple.com) → **Sign-In and Security** → **App-Specific Passwords**
2. Create one named `home-display` and copy it (format `abcd-efgh-ijkl-mnop`)
3. Set `ICLOUD_USERNAME` (your Apple ID email) and `ICLOUD_APP_PASSWORD` in `.env`

Choose which calendars show, and their colors, later from `/admin`.

### 1.3 Immich API key

1. Open your Immich instance in the browser (for example `http://YOUR_IMMICH_HOST:2283`)
2. Click your profile icon → **Account Settings**
3. Scroll to **API Keys** → click **New API Key**
4. Name it `home-display`, click **Create**
5. Copy the key — you can only see it once

### 1.4 Immich album ID

1. In Immich, open or create the album you want to use for the slideshow
2. Look at the URL — it ends in a UUID:
   ```
   http://YOUR_IMMICH_HOST:2283/albums/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
3. Copy that UUID — it is the `IMMICH_ALBUM_ID`

### 1.5 Weather coordinates

Find your latitude and longitude (decimal format). The easiest way:

1. Open [Google Maps](https://maps.google.com), right-click your location
2. Click the coordinates at the top of the context menu to copy them
3. Example: `37.7749, -122.4194` → `WEATHER_LAT=37.7749`, `WEATHER_LON=-122.4194`

---

## Part 2 — Deploy the server

### 2.1 Copy the project to your server

From your dev machine, push to GitHub and clone on your server — or use `scp`:

```bash
# Option A: GitHub
ssh your-server-host
git clone https://github.com/colinmarley/home-display /home/colin/code/home-display

# Option B: scp from Windows
scp -r /c/Users/colin/code/home-display your-server-host:/home/colin/code/home-display
```

### 2.2 Create the .env file on your server

```bash
ssh your-server-host
cd /home/colin/code/home-display
cp .env.example .env
nano .env   # or: vim .env
```

Fill in every value using what you collected in Part 1:

```env
GOOGLE_ICAL_URL=https://calendar.google.com/calendar/ical/...
APPLE_ICAL_URL=https://p01-caldav.icloud.com/published/2/...
WEATHER_LAT=37.7749
WEATHER_LON=-122.4194
IMMICH_BASE_URL=http://YOUR_IMMICH_HOST:2283
IMMICH_API_KEY=your_immich_api_key
IMMICH_ALBUM_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
IDLE_TIMEOUT_MINUTES=5
PHOTO_INTERVAL_SECONDS=30
```

Save the file. Confirm it is **not** tracked by git:
```bash
git status   # .env should not appear
```

### 2.3 Build and start the container

```bash
cd /home/colin/code/home-display
docker compose up -d --build
```

The first build takes 2–4 minutes (downloads Node 22, builds Next.js). Subsequent builds are faster due to layer caching.

### 2.4 Verify the server is running

```bash
docker compose ps          # container should show "Up"
docker compose logs -f     # watch for "Ready on http://0.0.0.0:3001"
```

Open **http://YOUR_SERVER_HOST:3001** in a browser on any device on the network. You should see the dashboard with the clock, weather strip, and week calendar.

> **Troubleshooting:** open `http://YOUR_SERVER_HOST:3001/admin` — the **Sync
> status** card shows each source's last successful sync and its last error
> (e.g. a 401 from iCloud means the app-specific password is wrong). The tab bar
> dot on the display is green when everything is fresh, amber when a source is
> failing but data is still recent, red when data is stale or the server is
> unreachable — tap it for details.

---

## Part 3 — Set up the Raspberry Pi

### 3.1 Assemble the hardware

The Official Raspberry Pi 7" Touchscreen connects to the Pi 4B via the **DSI ribbon cable** on the display board's connector.

1. Lay the touchscreen face-down on a soft surface
2. Connect the ribbon cable from the display PCB to the Pi's **DSI port** (the narrow port between the USB ports and HDMI, labelled "DISPLAY")
3. Mount the Pi onto the display using the four brass standoffs and screws (included in the display kit)
4. **Power:** The touchscreen draws power from the Pi via the jumper wires — connect **5V → 5V** and **GND → GND** on the GPIO header to the display PCB's PWR pins, or use the micro-USB power connector on the display PCB itself with a separate cable
5. A single USB-C cable into the Pi 4B powers both Pi and display

### 3.2 Flash the SD card

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your Windows machine
2. Click **Choose OS** → **Raspberry Pi OS (other)** → **Raspberry Pi OS Lite (64-bit)**
3. Click the **gear icon** (⚙) to open Advanced Options and configure:
   - **Hostname:** choose a local hostname for the Pi, for example `home-display`
   - **Enable SSH:** checked, "Use password authentication"
   - **Username:** `pi` — set a password you'll remember
   - **Configure wireless LAN:** enter your WiFi SSID and password
   - **Wireless LAN country:** set to your country code (e.g., `US`)
   - **Locale:** set timezone and keyboard layout
4. Click **Save**, then **Write**

> **Wired connection preferred:** If you can run an ethernet cable to the Pi's location during setup, use it — it avoids WiFi configuration issues.

### 3.3 First boot and SSH

1. Insert the SD card, connect the Pi (with display attached), and power on
2. Wait 60–90 seconds for first boot (the green LED on the Pi will stop flashing)
3. SSH in from your Windows machine:
   ```bash
   ssh pi@YOUR_PI_HOSTNAME.local
   ```
   If mDNS doesn't resolve your chosen hostname, find the Pi's IP from your router's DHCP table and use that directly.

### 3.4 Run the setup script

The setup script is served by your app server, so make sure the container is running before this step.

```bash
curl -s http://YOUR_SERVER_HOST:3001/setup.sh | sudo bash -s http://YOUR_SERVER_HOST:3001
```

The script will:
- Install `sway`, `chromium`, emoji fonts, and set the Pi's timezone
- Configure `getty@tty1` to auto-login and start sway → `kiosk-browser` (relaunches Chromium if it exits)
- Install `home-display-agent` (systemd): follows the night schedule on the backlight, restarts Chromium if the page stops sending heartbeats, and restarts it nightly at 03:30
- Disable screen blanking

It is safe to re-run after updating the server — it refreshes the wrapper and the agent.

When it finishes:
```bash
sudo reboot
```

### 3.5 Verify the kiosk

After reboot, the Pi boots straight into the **Today** screen with a tab bar
along the bottom (Today · Calendar · Weather · Lists · Photos). After 2 idle
minutes it returns to Today; after the configured idle time it starts the
slideshow. Check the agent with `systemctl status home-display-agent`.

> If the screen stays black or shows a terminal, see [Troubleshooting](#troubleshooting).

---

## Part 4 — Verification checklist

| Check | How to verify |
|-------|--------------|
| Server running | `docker compose ps` shows `Up (healthy)` |
| Sync healthy | `/admin` → Sync status: all sources updated within their interval |
| Calendars | Google and iCloud events both appear, recurring events on every week |
| Weather | Today screen shows current conditions, hourly strip, 4-day outlook |
| Lists | Add an item from `/admin` on a phone — it appears on the display within a minute |
| Slideshow | Leave the display idle — photos cycle with clock/weather overlay; tap to exit |
| Night mode | Set a night window covering now in `/admin` — screen dims; tap wakes it |
| Watchdog | `sudo pkill chromium` on the Pi — the browser comes back within seconds |

---

## Configuration reference

Secrets and sources live in `/home/colin/code/home-display/.env` (restart the
container after editing). Everything else — night schedule, idle timers, weather
source, calendar colors/visibility, special dates, countdowns, lists — is set from
`/admin` and stored in `./data`.

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_ICAL_URL`, `GOOGLE_ICAL_URL_*` | — | Google Calendar secret iCal URL(s) |
| `ICLOUD_USERNAME` / `ICLOUD_APP_PASSWORD` | — | iCloud CalDAV (all calendars on the account) |
| `APPLE_ICAL_URL`, `APPLE_ICAL_URL_*` | — | Fallback published iCloud links (used only without `ICLOUD_*`) |
| `ICAL_URL`, `ICAL_URL_*` | — | Any other `.ics` feeds |
| `DISPLAY_TZ` | `America/Los_Angeles` | Timezone everything is rendered in |
| `ADMIN_PIN` | — | Locks `/admin`; empty = open on the LAN |
| `WEATHER_LAT` / `WEATHER_LON` | — | Forecast location |
| `WEATHER_SOURCE` | `open-meteo` | Initial source (`open-meteo`, `open-meteo-gfs`, `open-meteo-ecmwf`, `nws`) |
| `IMMICH_BASE_URL` / `IMMICH_API_KEY` / `IMMICH_ALBUM_ID` | — | Slideshow album |
| `PHOTO_CACHE_MB` | `1024` | Cap for the local photo cache |
| `IDLE_TIMEOUT_MINUTES` / `PHOTO_INTERVAL_SECONDS` | `10` / `30` | Initial values; change in `/admin` |

---

## Maintenance

### Updating server code

```bash
ssh your-server-host
cd /home/colin/code/home-display
git pull
docker compose up -d --build
```

The display reloads itself within a minute of a new build going live.

### Display rotation

If the display is mounted upside-down or in portrait orientation, SSH into the Pi and edit `/boot/firmware/config.txt`:

```ini
# Upside-down landscape (180°)
display_rotate=2

# Portrait, cable at bottom (90° clockwise)
display_rotate=1

# Portrait, cable at top (90° counter-clockwise)
display_rotate=3
```

Save and `sudo reboot`.

### Static IP for the Pi

If the Pi's IP changes (DHCP), the display still works as long as it can still reach the server URL. Reserving a static DHCP lease for the Pi in your router is still good practice.

---

## Troubleshooting

**Black screen after reboot**
- SSH into the Pi: `ssh pi@YOUR_PI_HOSTNAME.local`
- Check sway / the browser loop: `journalctl -b | grep -i -E "sway|chromium"`
- Check the agent: `systemctl status home-display-agent` / `journalctl -u home-display-agent`
- Ensure the display is detected — `ls /dev/dri/`

**Calendar or photos missing / stale**
- Open `/admin` → Sync status for the exact error per source, and press **Sync now**
- Logs: `docker compose logs home-display | grep -E "\[sync\]|\[calendar\]|\[photo\]"`
- iCloud 401: regenerate the app-specific password. Immich 401/403: the API key was revoked or lacks `album.read` / `asset.view`

**Touch not working**
- The Official 7" Pi touchscreen uses USB HID for touch on Pi 4B — ensure the USB touch cable from the display PCB is connected to a Pi USB port (in addition to the DSI ribbon cable)
- Check: `ls /dev/input/` — should show `event0` or similar

**Pi connects to WiFi but can't reach the server**
- Both devices must be reachable on the same local network or routed VLANs.
- Test from Pi: `curl -I http://YOUR_SERVER_HOST:3001`

---

## Development (running locally)

```bash
cd home-display
cp .env.example .env   # fill in your values
npm install
npm run dev            # http://localhost:3000 (sync starts on boot; data in ./data)
```

For the Immich photo proxy to work, `IMMICH_BASE_URL` must be reachable from your dev machine.

To simulate the Pi's 800×480 viewport in Chrome DevTools: open DevTools → toggle device toolbar → set a custom device with 800×480.

```bash
npm test               # unit tests (recurrence expansion, timezones, sync fallback)
npm run build          # production build check
npx tsc --noEmit       # type check only
```
