# Pi Setup

Turns a Raspberry Pi 4B + 7" touchscreen into a dedicated kiosk display.

## Requirements

- Raspberry Pi 4B (any RAM)
- Raspberry Pi 7" Official Touchscreen (800×480)
- MicroSD card (8GB+)
- Pi on the same LAN as your app server

## Step 1 — Flash the SD card

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose OS: **Raspberry Pi OS Lite (64-bit)** (Bookworm)
3. Click the gear icon (⚙) before flashing and configure:
   - Hostname: `home-display`
   - Enable SSH
   - Set username: `pi` / password of your choice
   - Configure WiFi (SSID + password)
4. Flash to SD card

## Step 2 — First boot

Insert the card and power on the Pi. Wait ~60 seconds, then SSH in:

```bash
ssh pi@YOUR_PI_HOSTNAME.local
```

## Step 3 — Run the setup script

The setup script is served by the home-display app server.
Make sure the server is running first (`docker compose up -d` in `/opt/home-display`).

```bash
curl -s http://YOUR_SERVER_HOST:3001/setup.sh | sudo bash -s http://YOUR_SERVER_HOST:3001
```

Then reboot:

```bash
sudo reboot
```

The Pi will boot directly into the kiosk display. No desktop, no cursor.

## Display rotation

If the 7" display is mounted upside-down or in portrait mode, add to `/boot/firmware/config.txt`:

```ini
# Rotate 180° (upside-down landscape)
display_rotate=2

# Portrait (90°)
# display_rotate=1
```

## Updating

Changes to the server code are picked up automatically — the display reloads every 15 minutes.
To force an immediate reload: touch the screen and wait, or SSH in and reboot.

To update the server:
```bash
ssh your-server-host
cd /opt/home-display
git pull
docker compose up -d --build
```
