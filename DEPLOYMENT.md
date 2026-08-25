# Debian Kiosk Deployment

Run the installation as a headless audiovisual kiosk on Debian without a full desktop environment.

## Options

### Option 1: Cage (recommended)

Cage is a minimal Wayland kiosk compositor — runs a single app fullscreen with no desktop.

```bash
sudo apt install cage chromium
```

Run from TTY:
```bash
cage -- chromium --kiosk --autoplay-policy=no-user-gesture-required http://localhost:8000
```

**Note:** Cage is in Debian 12 (Bookworm) and later. For Debian 11 (Bullseye), use Option 3.

### Option 2: Labwc

Lightweight Wayland compositor, more configurable than Cage.

```bash
sudo apt install labwc chromium
```

Create autostart:
```bash
mkdir -p ~/.config/labwc
echo 'chromium --kiosk --autoplay-policy=no-user-gesture-required http://localhost:8000' > ~/.config/labwc/autostart
```

Run:
```bash
labwc
```

**Note:** Labwc is in Debian 12+. May need backports or flatpak on older versions.

### Option 3: X11 + Openbox (most compatible)

Works on any Debian version, including older hardware.

```bash
sudo apt install xorg openbox chromium
```

Create `~/.xinitrc`:
```bash
cat > ~/.xinitrc << 'EOF'
openbox &
chromium --kiosk --autoplay-policy=no-user-gesture-required http://localhost:8000
EOF
```

Run:
```bash
startx
```

## Chromium Flags

```bash
--kiosk                              # fullscreen, no browser UI
--autoplay-policy=no-user-gesture-required  # allow TTS without user click
--disable-infobars                   # hide "controlled by automation" bar
--noerrdialogs                       # suppress error popups
--disable-translate                  # no translate prompts
--check-for-update-interval=31536000 # disable update nag (1 year)
```

## Web Server

Serve the installation files locally:

```bash
# Simple (Python)
cd /path/to/installation
python3 -m http.server 8000

# Production (nginx)
sudo apt install nginx
sudo ln -s /path/to/installation /var/www/html/installation
# Then visit http://localhost/installation
```

## Auto-start on Boot

### Systemd service (for Cage)

Create `/etc/systemd/system/installation.service`:

```ini
[Unit]
Description=Art Installation
After=network.target

[Service]
User=YOUR_USERNAME
Environment=XDG_RUNTIME_DIR=/run/user/1000
WorkingDirectory=/path/to/installation
ExecStartPre=/usr/bin/python3 -m http.server 8000
ExecStart=/usr/bin/cage -- chromium --kiosk --autoplay-policy=no-user-gesture-required http://localhost:8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
```

Enable:
```bash
sudo systemctl enable installation
sudo systemctl start installation
```

### For X11/Openbox

Use a display manager like `nodm` for auto-login:

```bash
sudo apt install nodm
sudo nano /etc/default/nodm
# Set NODM_ENABLED=true and NODM_USER=your-username
```

Then `~/.xinitrc` runs automatically on boot.

## Prevent Screen Blanking

```bash
# X11
xset s off
xset -dpms
xset s noblank

# Wayland/Cage — typically doesn't blank, but check:
# Add to environment if needed
LIBGL_ALWAYS_SOFTWARE=1
```

## Audio Setup

Web Speech API uses system audio. Ensure:

```bash
# Check audio output
aplay -l

# Install PulseAudio if needed
sudo apt install pulseaudio

# For headless, you may need:
pulseaudio --start --daemonize
```

## Debian Version Compatibility

| Component | Debian 11 (Bullseye) | Debian 12 (Bookworm) |
|-----------|---------------------|---------------------|
| Cage | ✗ (not in repos) | ✓ `apt install cage` |
| Labwc | ✗ (not in repos) | ✓ `apt install labwc` |
| Openbox + X11 | ✓ | ✓ |
| Chromium | ✓ | ✓ |

## Troubleshooting

**Black screen with Cage:**
- Check if GPU drivers are loaded: `lsmod | grep -E 'i915|amdgpu|nouveau'`
- Try software rendering: `LIBGL_ALWAYS_SOFTWARE=1 cage -- chromium ...`

**No audio:**
- Check PulseAudio is running: `pactl info`
- Ensure user is in `audio` group: `sudo usermod -aG audio $USER`

**Chromium crashes:**
- Try with `--disable-gpu` flag
- Check memory: `free -h`
