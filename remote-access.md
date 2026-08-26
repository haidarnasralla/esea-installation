# ESEA Installation Remote Access Runbook

## Connection Details

| Field | Value |
|-------|-------|
| Internal IP | `192.168.1.95` |
| External IP | `92.27.135.1` |
| Hostname | `haidar` |
| User | `haidarnasralla` |
| OS | Debian GNU/Linux (kernel 6.12) |

```bash
# From local network
ssh haidarnasralla@192.168.1.95

# From external network
ssh haidarnasralla@92.27.135.1
```

## System Overview

The installation runs a kiosk display using:

- **Web server**: Python HTTP server on port 3000, managed by systemd
- **Display**: Chromium in kiosk mode, auto-started on login
- **Auto-refresh**: Systemd timer restarts the server and refreshes the browser at 09:30, 12:00, and 17:00 daily

## Health Checks

### Quick Status

```bash
# Check web server is running
systemctl status installation-server

# Check refresh timer is active
systemctl status installation-refresh.timer

# See when next refresh is scheduled
systemctl list-timers installation-refresh.timer
```

### Expected Healthy Output

- `installation-server.service`: **active (running)**
- `installation-refresh.timer`: **active (waiting)**
- Timer shows next trigger time in the future

### Check Web Content is Accessible

```bash
curl -I http://localhost:3000/
```

Expected: `HTTP/1.0 200 OK`

### Check Display is Running

```bash
pgrep -a chromium
```

Expected: Chromium process with `--kiosk` and `http://localhost:3000/` in arguments

## Manual Interventions

### Restart the Web Server

```bash
sudo systemctl restart installation-server
```

### Force a Full Refresh (Server + Browser)

```bash
sudo systemctl start installation-refresh.service
```

This runs the refresh script manually, which:
1. Restarts the web server
2. Sends F5 to the Chromium kiosk browser

### Restart Chromium Kiosk

If the browser has crashed or frozen:

```bash
# Kill existing Chromium
pkill chromium

# Restart it in the user's X session
runuser -u haidarnasralla -- env DISPLAY=:0 XAUTHORITY=/home/haidarnasralla/.Xauthority \
  chromium --kiosk --autoplay-policy=no-user-gesture-required --disable-infobars \
  --noerrdialogs --disable-session-crashed-bubble --disable-translate http://localhost:3000/
```

Or simply reboot the machine:

```bash
sudo reboot
```

## Key File Locations

| File | Purpose |
|------|---------|
| `/etc/systemd/system/installation-server.service` | Web server service unit |
| `/etc/systemd/system/installation-refresh.service` | Refresh oneshot service |
| `/etc/systemd/system/installation-refresh.timer` | Scheduled refresh timer |
| `/usr/local/bin/refresh-installation.sh` | Refresh script (restarts server + sends F5) |
| `~/.config/autostart/installation.desktop` | Chromium kiosk autostart |

## Logs

```bash
# Web server logs
journalctl -u installation-server -f

# Refresh service logs
journalctl -u installation-refresh.service --since today
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Black screen | Chromium crashed | Restart Chromium or reboot |
| Stale content | Refresh didn't run | Run `sudo systemctl start installation-refresh.service` |
| 404 errors in logs | Missing files in served directory | Check content in the web root |
| Server not starting | Python or port issue | Check `journalctl -u installation-server` for errors |

## Technical Notes

### Installation Content

The served content is a client-side JavaScript animation featuring:
- Formant/TTS synthesis (SAM-based)
- Markov text generation
- Degradation cycle effects

All state is client-side. No server-side state or databases.

### Refresh Behavior

F5 refresh fully resets the installation:
- Reloads HTML/JS from disk
- Restarts animation from beginning
- Resets degradation cycle
- Re-initializes audio/TTS

The 3x daily scheduled refresh (09:30, 12:00, 17:00) prevents the installation from running too long without a clean reset.

### Display Stack

- **X11** — Required for xdotool refresh mechanism
- **Wayland** — Not compatible (xdotool won't work); would need ydotool or alternative
- **Remote viewing** — Use x11vnc to see the physical display over VNC

### Auto-Login (KDE Plasma / SDDM)

If the machine prompts for login on boot, enable auto-login by creating `/etc/sddm.conf.d/autologin.conf`:

```ini
[Autologin]
User=haidarnasralla
Session=plasmax11
```

### Disable Unnecessary Startup Apps

For a cleaner kiosk startup, disable services that aren't needed:

```bash
mkdir -p ~/.config/autostart

# Disable KDE Wallet prompt
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/pam_kwallet_init.desktop

# Disable Baloo file indexer (wastes resources)
kwriteconfig5 --file baloofilerc --group 'Basic Settings' --key 'Indexing-Enabled' 'false'

# Disable KDE Connect
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/org.kde.kdeconnect.daemon.desktop

# Disable software update notifier
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/org.kde.discover.notifier.desktop

# Disable calendar reminders
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/org.kde.kalendarac.desktop

# Disable Wayland video bridge (not needed on X11)
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/org.kde.xwaylandvideobridge.desktop

# Disable accessibility screen reader
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/orca-autostart.desktop

# Disable print applet
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/print-applet.desktop

# Disable backup daemon
echo -e '[Desktop Entry]\nHidden=true' > ~/.config/autostart/kup-daemon.desktop
```

### Chromium Kiosk Flags

If Chromium opens multiple windows on boot (default page + kiosk), add these flags to `~/.config/autostart/installation.desktop`:

```
Exec=chromium --kiosk --autoplay-policy=no-user-gesture-required --disable-infobars --noerrdialogs --disable-session-crashed-bubble --disable-translate --no-first-run --no-default-browser-check --disable-restore-session-state http://localhost:3000/
```

Key flags:
- `--no-first-run` — Skips welcome/setup
- `--no-default-browser-check` — Prevents default browser prompt
- `--disable-restore-session-state` — Stops restoring previous tabs

### Remote Viewing with x11vnc

Install and setup (one-time):
```bash
sudo apt install x11vnc
mkdir -p ~/.vnc
x11vnc -storepasswd RoastedPenguin66! ~/.vnc/passwd
```

Start from SSH session (full control—mouse and keyboard):
```bash
x11vnc -display :0 -auth /home/haidarnasralla/.Xauthority -forever -localhost -rfbauth ~/.vnc/passwd
```

Or view-only mode (no interaction, just monitoring):
```bash
x11vnc -display :0 -auth /home/haidarnasralla/.Xauthority -forever -localhost -rfbauth ~/.vnc/passwd -viewonly
```

VNC password: `RoastedPenguin66!`

The `-localhost` flag restricts connections to localhost only (more secure).

To connect, first open an SSH tunnel from your local machine:
```bash
ssh -L 5900:localhost:5900 haidarnasralla@92.27.135.1
```

Then connect your VNC client to:
```
vnc://localhost:5900
```

This tunnels VNC over SSH—no need to open port 5900 externally.

Mirrors the physical display exactly. Not visible to installation viewers.