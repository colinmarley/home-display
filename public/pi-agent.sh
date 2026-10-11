#!/usr/bin/env bash
# Home Display — Pi display agent (installed to /usr/local/bin by setup.sh,
# runs as root via home-display-agent.service).
#
#  * Backlight: follows the server's night schedule (day / dim / off).
#  * Watchdog:  restarts Chromium when the page stops sending heartbeats
#               (hung tab, white screen, crashed renderer).
#  * Hygiene:   restarts Chromium once a night to bound memory growth.
#
# Config: /etc/default/home-display (APP_URL, KIOSK_USER, NIGHTLY_RESTART).

set -u
APP_URL="${APP_URL:-http://192.168.0.239:3001}"
KIOSK_USER="${KIOSK_USER:-pi}"
NIGHTLY_RESTART="${NIGHTLY_RESTART:-03:30}"
POLL_SECONDS="${POLL_SECONDS:-3}"
HEARTBEAT_TIMEOUT="${HEARTBEAT_TIMEOUT:-300}"

BL=$(ls -d /sys/class/backlight/* 2>/dev/null | head -1)
log() { echo "[agent] $*"; }

if [[ -n "$BL" ]]; then
  MAX=$(cat "$BL/max_brightness")
  log "backlight $BL (max $MAX)"
else
  log "no backlight device found — brightness control disabled"
fi

last_level=""
last_restart=$(date +%s)
nightly_done=""

set_backlight() { # mode percent
  [[ -z "$BL" ]] && return
  local level
  if [[ "$1" == "off" || "$2" -le 0 ]]; then
    level="off"
  else
    level=$(( $2 * MAX / 100 ))
    (( level < 1 )) && level=1
  fi
  [[ "$level" == "$last_level" ]] && return
  if [[ "$level" == "off" ]]; then
    echo 1 > "$BL/bl_power" 2>/dev/null || echo 0 > "$BL/brightness"
  else
    [[ -w "$BL/bl_power" ]] && echo 0 > "$BL/bl_power"
    echo "$level" > "$BL/brightness"
  fi
  log "backlight -> $level ($1)"
  last_level="$level"
}

restart_browser() {
  log "restarting chromium: $1"
  # kiosk-browser (sway exec) relaunches it immediately.
  pkill -TERM -u "$KIOSK_USER" -f '/chromium' || true
  last_restart=$(date +%s)
}

while true; do
  now=$(date +%s)
  if state=$(curl -fsS --max-time 5 "$APP_URL/api/display/state?format=text" 2>/dev/null); then
    read -r mode bright hb_age <<<"$state"
    set_backlight "$mode" "$bright"
    # Heartbeat is posted by the page every 60 s. -1 = server restarted, none yet.
    if [[ "$hb_age" =~ ^[0-9]+$ ]] && (( hb_age > HEARTBEAT_TIMEOUT )) && (( now - last_restart > HEARTBEAT_TIMEOUT )); then
      restart_browser "no page heartbeat for ${hb_age}s"
    fi
  else
    # Server unreachable: leave the screen as it is; Chromium shows the last data.
    [[ -z "$last_level" ]] && set_backlight day 100
  fi

  today=$(date +%F)
  if [[ "$(date +%H:%M)" == "$NIGHTLY_RESTART" && "$nightly_done" != "$today" ]]; then
    nightly_done="$today"
    restart_browser "nightly restart"
  fi
  sleep "$POLL_SECONDS"
done
