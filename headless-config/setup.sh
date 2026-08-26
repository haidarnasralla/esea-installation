#!/bin/bash
# =============================================================================
# ESEA Installation Kiosk Setup Script
# =============================================================================
# This script configures a Debian/KDE Plasma machine as a kiosk display.
# Run this via SSH on the target machine.
#
# Prerequisites:
# - Debian with KDE Plasma (X11 session)
# - User 'haidarnasralla' exists
# - This repo cloned to /home/haidarnasralla/Documents/esea-installation
# - Run as root (sudo) for system file changes
#
# Safe to re-run on an already-configured system.
# =============================================================================

set -e  # Exit on any error

# Check we're running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo bash setup.sh"
    exit 1
fi

REPO_DIR="/home/haidarnasralla/Documents/esea-installation"
CONFIG_DIR="$REPO_DIR/headless-config"
USER="haidarnasralla"

echo "=== ESEA Installation Kiosk Setup ==="
echo ""

# -----------------------------------------------------------------------------
# STEP 1: Disable automatic updates
# -----------------------------------------------------------------------------
# Prevents package updates during the installation run.
# Re-enable after with: sudo systemctl enable --now apt-daily.timer apt-daily-upgrade.timer

echo "[1/11] Disabling automatic updates..."

systemctl stop apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true
systemctl disable apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true
echo "  → Automatic updates disabled"

# -----------------------------------------------------------------------------
# STEP 2: Power Management - Prevent sleep/suspend
# -----------------------------------------------------------------------------
# This must be done early so the machine doesn't sleep during setup or operation.
# We append settings to logind.conf if they're not already present.

echo "[2/11] Configuring power management (prevent sleep/suspend)..."

if ! grep -q "^HandleLidSwitch=ignore" /etc/systemd/logind.conf; then
    cat >> /etc/systemd/logind.conf << 'EOF'

# ESEA Kiosk - Prevent sleep/suspend
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
EOF
    systemctl restart systemd-logind
    echo "  → Power management configured"
else
    echo "  → Already configured, skipping"
fi

# -----------------------------------------------------------------------------
# STEP 3: Install required packages
# -----------------------------------------------------------------------------
# xdotool: sends keystrokes to refresh the browser
# x11vnc: allows remote viewing of the display

echo "[3/11] Installing required packages..."

apt-get update -qq
apt-get install -y -qq xdotool x11vnc
echo "  → Packages installed"

# -----------------------------------------------------------------------------
# STEP 4: Copy systemd service files
# -----------------------------------------------------------------------------
# These define the web server and refresh timer.

echo "[4/11] Installing systemd services..."

cp "$CONFIG_DIR/installation-server.service" /etc/systemd/system/
cp "$CONFIG_DIR/installation-refresh.service" /etc/systemd/system/
cp "$CONFIG_DIR/installation-refresh.timer" /etc/systemd/system/

# Copy the refresh script and make it executable
cp "$CONFIG_DIR/refresh-installation.sh" /usr/local/bin/
chmod +x /usr/local/bin/refresh-installation.sh

# Reload systemd to pick up new/changed files
systemctl daemon-reload
echo "  → Systemd files installed"

# -----------------------------------------------------------------------------
# STEP 5: Enable and start services
# -----------------------------------------------------------------------------
# Order matters: server must be running before the timer tries to refresh it.

echo "[5/11] Enabling and starting services..."

# Enable services to start on boot
systemctl enable installation-server.service
systemctl enable installation-refresh.timer

# Start (or restart if already running) the web server
systemctl restart installation-server.service

# Start the timer
systemctl start installation-refresh.timer

echo "  → Services running"

# -----------------------------------------------------------------------------
# STEP 6: Configure SDDM auto-login
# -----------------------------------------------------------------------------
# This allows the machine to boot directly to the desktop without a login prompt.

echo "[6/11] Configuring SDDM auto-login..."

mkdir -p /etc/sddm.conf.d
cp "$CONFIG_DIR/sddm-autologin.conf" /etc/sddm.conf.d/autologin.conf
echo "  → Auto-login configured for user '$USER'"

# -----------------------------------------------------------------------------
# STEP 7: Disable unnecessary startup applications
# -----------------------------------------------------------------------------
# These services are not needed for a kiosk and may cause prompts or use resources.

echo "[7/11] Disabling unnecessary startup apps..."

USER_AUTOSTART="/home/$USER/.config/autostart"
mkdir -p "$USER_AUTOSTART"

# Create override files that disable system autostart entries
for app in pam_kwallet_init org.kde.kdeconnect.daemon org.kde.discover.notifier \
           org.kde.kalendarac org.kde.xwaylandvideobridge orca-autostart \
           print-applet kup-daemon; do
    echo -e '[Desktop Entry]\nHidden=true' > "$USER_AUTOSTART/$app.desktop"
done

# Disable Baloo file indexer (wastes resources)
sudo -u "$USER" kwriteconfig5 --file baloofilerc --group 'Basic Settings' --key 'Indexing-Enabled' 'false'

# Fix ownership
chown -R "$USER:$USER" "$USER_AUTOSTART"

echo "  → Startup apps disabled"

# -----------------------------------------------------------------------------
# STEP 8: Install Chromium kiosk autostart
# -----------------------------------------------------------------------------
# This launches Chromium in kiosk mode after login.
# Includes flags to prevent restore prompts and first-run dialogs.

echo "[8/11] Installing Chromium kiosk autostart..."

cp "$CONFIG_DIR/installation.desktop" "$USER_AUTOSTART/"
chown "$USER:$USER" "$USER_AUTOSTART/installation.desktop"
echo "  → Chromium autostart installed"

# -----------------------------------------------------------------------------
# STEP 9: Set volume to max on login
# -----------------------------------------------------------------------------
# Ensures audio is at 100% every time the kiosk starts.

echo "[9/11] Configuring max volume on login..."

cat > "$USER_AUTOSTART/max-volume.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Set Max Volume
Exec=pactl set-sink-volume @DEFAULT_SINK@ 100%
EOF
chown "$USER:$USER" "$USER_AUTOSTART/max-volume.desktop"
echo "  → Max volume autostart installed"

# -----------------------------------------------------------------------------
# STEP 10: Disable WiFi and Bluetooth
# -----------------------------------------------------------------------------
# Reduces interference and power usage. Done at system level (not user login).

echo "[10/11] Disabling WiFi and Bluetooth..."

rfkill block wifi 2>/dev/null || true
rfkill block bluetooth 2>/dev/null || true

# Make it persistent across reboots by creating a systemd service
cat > /etc/systemd/system/disable-radios.service << 'EOF'
[Unit]
Description=Disable WiFi and Bluetooth radios
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/rfkill block wifi
ExecStart=/usr/sbin/rfkill block bluetooth
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable disable-radios.service
echo "  → WiFi/Bluetooth disabled"

# -----------------------------------------------------------------------------
# STEP 11: Setup VNC password for remote viewing
# -----------------------------------------------------------------------------
# This stores an encrypted password for x11vnc.

echo "[11/11] Setting up VNC password..."

VNC_DIR="/home/$USER/.vnc"
mkdir -p "$VNC_DIR"
x11vnc -storepasswd 'RoastedPenguin66!' "$VNC_DIR/passwd"
chown -R "$USER:$USER" "$VNC_DIR"
echo "  → VNC password stored"

# =============================================================================
# VERIFICATION
# =============================================================================

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Verifying services..."
echo ""

# Check web server
if systemctl is-active --quiet installation-server.service; then
    echo "✓ Web server: running"
else
    echo "✗ Web server: NOT running"
fi

# Check timer
if systemctl is-active --quiet installation-refresh.timer; then
    echo "✓ Refresh timer: active"
    echo "  Next refresh: $(systemctl list-timers installation-refresh.timer --no-pager | grep installation | awk '{print $1, $2, $3}')"
else
    echo "✗ Refresh timer: NOT active"
fi

# Check web content is accessible
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "200"; then
    echo "✓ Web content: accessible at http://localhost:3000/"
else
    echo "✗ Web content: NOT accessible"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Reboot to test auto-login and Chromium kiosk: sudo reboot"
echo "2. To view remotely, SSH in and run:"
echo "   x11vnc -display :0 -auth /home/$USER/.Xauthority -forever -localhost -rfbauth ~/.vnc/passwd"
echo "3. Then tunnel from your local machine:"
echo "   ssh -L 5900:localhost:5900 $USER@92.27.135.1"
echo "4. Connect VNC client to: vnc://localhost:5900"
echo ""
echo "=== Post-Installation ==="
echo "After the exhibition ends, re-enable automatic updates:"
echo "   sudo systemctl enable --now apt-daily.timer apt-daily-upgrade.timer"
echo ""
