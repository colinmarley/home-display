#!/usr/bin/env bash
# Home Display — Pi kiosk setup script
# Usage: bash <(curl -s http://YOUR_SERVER_HOST:3001/setup.sh) [APP_URL]
# Targets: Raspberry Pi OS Lite 64-bit (Bookworm), user: pi
set -e

APP_URL="${1:-http://YOUR_SERVER_HOST:3001}"
KIOSK_USER="${SUDO_USER:-pi}"
KIOSK_UID=$(id -u "$KIOSK_USER" 2>/dev/null || echo "1000")

echo "==> Home Display Pi Setup"
echo "    App URL     : $APP_URL"
echo "    Kiosk user  : $KIOSK_USER (uid $KIOSK_UID)"
echo ""

# ── Packages ─────────────────────────────────────────────────────────────────
echo "==> Installing packages..."
apt-get update -qq
apt-get install -y --no-install-recommends \
  cage \
  chromium-browser \
  libinput-tools \
  fonts-noto \
  xdg-user-dirs \
  2>&1 | grep -v "^Get\|^Fetch\|^Hit\|^Reading\|^Building\|^Calculating"

# ── Auto-login on tty1 ────────────────────────────────────────────────────────
echo "==> Configuring auto-login for $KIOSK_USER on tty1..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

# ── Kiosk launch in .bash_profile ────────────────────────────────────────────
PROFILE_FILE="/home/$KIOSK_USER/.bash_profile"
echo "==> Writing kiosk launch to $PROFILE_FILE..."

cat > "$PROFILE_FILE" << PROFILE
# Auto-launch kiosk on tty1
if [[ -z "\$WAYLAND_DISPLAY" && "\$(tty)" == "/dev/tty1" ]]; then
  # Disable screen blanking
  export XDG_RUNTIME_DIR=/run/user/\$(id -u)

  # Ensure runtime dir exists
  mkdir -p "\$XDG_RUNTIME_DIR"
  chmod 700 "\$XDG_RUNTIME_DIR"

  exec cage -- chromium-browser \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --touch-events=enabled \\
    --ozone-platform=wayland \\
    --disable-features=TranslateUI \\
    --disable-session-crashed-bubble \\
    --disable-restore-session-state \\
    --check-for-update-interval=31536000 \\
    "$APP_URL"
fi
PROFILE

chown "$KIOSK_USER:$KIOSK_USER" "$PROFILE_FILE"

# ── Disable DPMS / screen blanking via kernel console ────────────────────────
echo "==> Disabling screen blanking..."
CMDLINE="/boot/firmware/cmdline.txt"
if [[ -f "$CMDLINE" ]]; then
  if ! grep -q "consoleblank=0" "$CMDLINE"; then
    sed -i 's/$/ consoleblank=0/' "$CMDLINE"
  fi
fi

# Disable console screen saver
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-blanking.conf << EOF
Section "ServerFlags"
  Option "BlankTime"   "0"
  Option "StandbyTime" "0"
  Option "SuspendTime" "0"
  Option "OffTime"     "0"
EndSection
EOF

# ── Enable getty autologin ────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable getty@tty1

echo ""
echo "✓ Setup complete. Reboot to start the kiosk:"
echo "  sudo reboot"
