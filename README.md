# Home Display

A self-hosted DakBoard replacement for a Raspberry Pi 4B + 7" official touchscreen. Boots directly into a full-screen kiosk display — no desktop, no cursor — showing:

- **Weekly calendar** synced from Google Calendar and Apple iCloud, with tap-to-drill-down day view
- **5-day weather forecast** (Open-Meteo, free, no API key)
- **Photo slideshow** from a local Immich server when idle

The display app (Next.js) runs in a Docker container on your server and is served over the LAN to the Pi. Updates are deployed to the server; the Pi never needs to be touched again.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  your server — always-on host                                              │
│  /home/colin/code/home-display/docker-compose.yml  →  port 3001            │
│                                                                             │
│  Next.js app                                                                │
│    /api/calendar  ← fetches Google + Apple iCal URLs every 15 min          │
│    /api/weather   ← Open-Meteo 7-day forecast, cached 1 hr                 │
│    /api/photos    ← Immich album asset listing, cached 1 hr                │
│    /api/photo/proxy?id=  ← proxies Immich thumbnails (keeps API key LAN)   │
│    .env           ← all secrets, never in git                              │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ LAN  http://YOUR_SERVER_HOST:3001
┌────────────────────────────────────▼────────────────────────────────────────┐
│  Raspberry Pi 4B  +  Official 7" Touchscreen (800×480)                     │
│                                                                             │
│  Raspberry Pi OS Lite 64-bit (Bookworm)                                    │
│  systemd auto-login → cage (Wayland compositor)                            │
│    → chromium-browser --kiosk http://YOUR_SERVER_HOST:3001                 │
│         → React app with Pointer API touch events, no cursor               │
└─────────────────────────────────────────────────────────────────────────────┘
```

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

### 1.2 Apple iCloud Calendar iCal URL

1. Open [iCloud.com](https://icloud.com) → **Calendar**
2. Click the share icon (circle with dot) next to the calendar you want
3. Check **"Public Calendar"**
4. Click **Copy Link** — it looks like:
   ```
   https://p01-caldav.icloud.com/published/2/XXXXXXXXXXXXXXXXXXXXXXXX
   ```
5. Save this URL — it is the `APPLE_ICAL_URL` in your `.env`

> **Note:** The public link is a read-only iCal feed — it does not expose write access to your calendar.

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

> **Troubleshooting:** If the calendar shows no events, check that your iCal URLs are correct and publicly accessible. Test from your server:
> ```bash
> curl -s "YOUR_GOOGLE_ICAL_URL" | head -5
> # Should output: BEGIN:VCALENDAR
> ```

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
- Install `cage` (minimal Wayland compositor), `chromium-browser`, `fonts-noto`
- Configure `getty@tty1` to auto-login as user `pi`
- Write `~/.bash_profile` to launch `cage` → `chromium-browser --kiosk` on tty1
- Disable screen blanking

When it finishes:
```bash
sudo reboot
```

### 3.5 Verify the kiosk

After reboot, the Pi should boot directly into the dashboard. You will see:
- No desktop environment, no taskbar, no cursor
- The clock and weather strip on the left
- The weekly calendar filling the right portion
- Touch: tap any day to see the hourly breakdown, tap the back arrow to return

> If the screen stays black or shows a terminal, see [Troubleshooting](#troubleshooting).

---

## Part 4 — Verification checklist

| Check | How to verify |
|-------|--------------|
| Server running | `docker compose ps` on your server shows `Up` |
| Calendar loads | Open `http://YOUR_SERVER_HOST:3001` in a browser — events from this week are visible |
| Google events | At least one Google Calendar event appears in the week view |
| Apple events | At least one Apple Calendar event appears (different color) |
| Weather strip | Left panel shows 5 days of forecast with temperature and emoji |
| Idle slideshow | Leave the display untouched for 5 minutes — photos should begin cycling |
| Touch — week → day | Tap any day column on the Pi — switches to hourly timeline |
| Touch — day → week | Tap the ← Back button — returns to week view |
| Touch — slideshow → calendar | Tap screen during slideshow — returns to calendar |
| Auto-refresh | After 15 minutes, the page reloads to pick up any new events |

---

## Configuration reference

All settings live in `/home/colin/code/home-display/.env` on your server. Edit and restart to apply:

```bash
ssh your-server-host
cd /home/colin/code/home-display
nano .env
docker compose restart
```

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_ICAL_URL` | — | Google Calendar private iCal URL |
| `APPLE_ICAL_URL` | — | Apple iCloud Calendar public iCal URL |
| `WEATHER_LAT` | — | Latitude for weather forecast |
| `WEATHER_LON` | — | Longitude for weather forecast |
| `IMMICH_BASE_URL` | — | Immich server URL (LAN) |
| `IMMICH_API_KEY` | — | Immich API key |
| `IMMICH_ALBUM_ID` | — | UUID of the Immich album for slideshow |
| `IDLE_TIMEOUT_MINUTES` | `5` | Minutes of inactivity before slideshow starts |
| `PHOTO_INTERVAL_SECONDS` | `30` | Seconds between photo transitions |

### Adding multiple calendars

The current implementation supports one Google and one Apple iCal URL. To add more calendars (e.g., a shared family calendar), edit `lib/calendar.ts` and extend the `sources` array:

```typescript
const sources = [
  { url: process.env.GOOGLE_ICAL_URL!,   source: 'google', color: '#4285f4' },
  { url: process.env.GOOGLE_ICAL_URL_2!, source: 'google', color: '#0f9d58' },
  { url: process.env.APPLE_ICAL_URL!,    source: 'apple',  color: '#fc3158' },
]
```

---

## Maintenance

### Updating server code

```bash
ssh your-server-host
cd /home/colin/code/home-display
git pull
docker compose up -d --build
```

The Pi reloads automatically within 15 minutes, or immediately if you power-cycle it.

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
- Check if cage started: `journalctl -xe | grep cage`
- Manually test: `cage -- chromium-browser --kiosk http://YOUR_SERVER_HOST:3001`
- If cage fails: ensure the display is detected — `ls /dev/dri/`

**Dashboard loads but calendar is empty**
- Verify iCal URLs are correct: `curl -sI "YOUR_URL"` should return `200 OK`
- Check server logs: `docker compose logs home-display | grep calendar`
- Google Calendar URLs expire if the calendar is deleted or settings are changed — regenerate the secret address

**Photos not showing in slideshow**
- Check the Immich API key is valid: `curl -H "x-api-key: YOUR_KEY" http://YOUR_IMMICH_HOST:2283/api/albums`
- Verify the album ID is correct (compare to the UUID in the Immich URL)
- Check proxy logs: `docker compose logs home-display | grep photo`

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
npm run dev            # http://localhost:3000
```

For the Immich photo proxy to work, `IMMICH_BASE_URL` must be reachable from your dev machine.

To simulate the Pi's 800×480 viewport in Chrome DevTools: open DevTools → toggle device toolbar → set a custom device with 800×480.

```bash
npm run build          # production build check
npx tsc --noEmit       # type check only
```
