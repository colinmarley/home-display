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
  chromium \
  libinput-tools \
  fonts-noto \
  fonts-noto-color-emoji \
  x11-apps \
  xdg-user-dirs

# ── Auto-login on tty1 ────────────────────────────────────────────────────────
echo "==> Configuring auto-login for $KIOSK_USER on tty1..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

# ── Blank cursor theme (hides hardware cursor in cage/Wayland) ────────────────
echo "==> Creating blank cursor theme..."
CURSOR_DIR="/home/$KIOSK_USER/.icons/blank/cursors"
SYS_CURSOR_DIR="/usr/share/icons/blank/cursors"
mkdir -p "$CURSOR_DIR" "$SYS_CURSOR_DIR"

# Write Xcursor binary directly — multiple nominal sizes so any XCURSOR_SIZE hits
python3 - "$CURSOR_DIR" "$SYS_CURSOR_DIR" <<'PYEOF'
import struct, os, sys

def make_xcursor(sizes):
    IMAGE_TYPE = 0xfffd0002
    ntoc = len(sizes)
    header = struct.pack('<4sIII', b'Xcur', 16, 0x00010000, ntoc)
    toc = b''
    offset = 16 + 12 * ntoc
    for size in sizes:
        toc += struct.pack('<III', IMAGE_TYPE, size, offset)
        offset += 40  # 36-byte chunk header + 4-byte pixel
    chunks = b''
    for size in sizes:
        chunks += struct.pack('<IIIIIIIII', 36, IMAGE_TYPE, size, 1, 1, 1, 0, 0, 50)
        chunks += b'\x00\x00\x00\x00'  # 1x1 transparent ARGB pixel
    return header + toc + chunks

cursor_data = make_xcursor([1, 8, 16, 24, 32, 48])
cursor_names = ['left_ptr', 'arrow', 'top_left_arrow', 'hand1', 'hand2',
                'watch', 'xterm', 'pointer', 'cross', 'move',
                'sb_h_double_arrow', 'sb_v_double_arrow']

for d in sys.argv[1:]:
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'default'), 'wb') as f:
        f.write(cursor_data)
    for name in cursor_names:
        target = os.path.join(d, name)
        if os.path.lexists(target):
            os.remove(target)
        os.symlink('default', target)
PYEOF

for dir_path in "$CURSOR_DIR" "$SYS_CURSOR_DIR"; do
  echo -e '[Icon Theme]\nName=blank' > "$(dirname "$dir_path")/index.theme"
done
chown -R "$KIOSK_USER:$KIOSK_USER" "/home/$KIOSK_USER/.icons"

# ── Kiosk launch in .bash_profile ────────────────────────────────────────────
PROFILE_FILE="/home/$KIOSK_USER/.bash_profile"
echo "==> Writing kiosk launch to $PROFILE_FILE..."

# Write via printf to avoid heredoc variable expansion issues
printf '%s\n' \
  'if [[ -z "$WAYLAND_DISPLAY" && "$(tty)" == "/dev/tty1" ]]; then' \
  '  export XDG_RUNTIME_DIR=/run/user/$(id -u)' \
  '  mkdir -p "$XDG_RUNTIME_DIR"' \
  '  chmod 700 "$XDG_RUNTIME_DIR"' \
  '  export XCURSOR_THEME=blank' \
  '  export XCURSOR_SIZE=24' \
  '  export WLR_NO_HARDWARE_CURSORS=1' \
  "  exec cage -- chromium \\" \
  '    --kiosk \' \
  '    --noerrdialogs \' \
  '    --disable-infobars \' \
  '    --touch-events=enabled \' \
  '    --ozone-platform=wayland \' \
  '    --disable-features=TranslateUI \' \
  '    --disable-session-crashed-bubble \' \
  '    --disable-restore-session-state \' \
  '    --check-for-update-interval=31536000 \' \
  "    \"$APP_URL\"" \
  'fi' \
  > "$PROFILE_FILE"

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
