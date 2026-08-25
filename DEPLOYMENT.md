# Debian Laptop Deployment

Run the installation on a Debian laptop with KDE.

## Why KDE (not Cage)

Cage is for headless boxes where you can't access the screen. A laptop already has a keyboard and display — use KDE so you can troubleshoot directly if needed. The ~500MB RAM overhead is irrelevant with 20GB available.

## Setup

### 1. Install dependencies

```bash
sudo apt install chromium python3
```

### 2. Clone the installation

```bash
cd ~
git clone <your-repo-url> installation
```

### 3. Create web server service

Create `/etc/systemd/system/installation-server.service`:

```ini
[Unit]
Description=Installation Web Server
After=network.target

[Service]
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/installation
ExecStart=/usr/bin/python3 -m http.server 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable it:
```bash
sudo systemctl enable installation-server
sudo systemctl start installation-server
```

### 4. Chromium autostart

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/installation.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Installation
Exec=chromium --kiosk --autoplay-policy=no-user-gesture-required --disable-infobars --noerrdialogs http://localhost:8000
X-KDE-autostart-after=panel
EOF
```

### 5. KDE settings

In System Settings:

- **Startup and Shutdown → Login Screen (SDDM)** → Auto-login your user
- **Power Management** → Disable screen dimming, sleep, and lid close actions
- **Screen Locking** → Disable automatic lock
- **Workspace Behavior → Screen Edges** → Disable all (prevents accidental triggers)

### 6. Prevent sleep on lid close

Edit `/etc/systemd/logind.conf`:
```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

Then:
```bash
sudo systemctl restart systemd-logind
```

## Remote Management (SSH)

### Update code

```bash
ssh user@laptop-ip
cd ~/installation
git pull
```

### Refresh browser

```bash
# Install xdotool if not present
sudo apt install xdotool

# Send F5 to refresh
DISPLAY=:0 xdotool key F5
```

### Restart everything

```bash
sudo systemctl restart installation-server
DISPLAY=:0 xdotool key F5
```

### Check status

```bash
systemctl status installation-server
```

## Audio

Ensure PulseAudio is running (KDE usually handles this):

```bash
pactl info
```

If no sound, check:
```bash
# List outputs
pactl list sinks short

# Ensure user is in audio group
sudo usermod -aG audio $USER
```

## Troubleshooting

**Browser not fullscreen:**
- Press F11, or close and let autostart relaunch it
- Check `~/.config/autostart/installation.desktop` exists

**No audio from TTS:**
- Chromium needs `--autoplay-policy=no-user-gesture-required`
- Check system volume isn't muted

**Screen going to sleep:**
- Double-check Power Management settings
- Verify `/etc/systemd/logind.conf` changes

**Can't SSH in:**
```bash
sudo apt install openssh-server
sudo systemctl enable ssh
```

**Find laptop IP:**
```bash
ip addr | grep inet
# or from the laptop
hostname -I
```

## On-site checklist

- [ ] Laptop plugged in
- [ ] HDMI/display connected
- [ ] Audio cable connected (or use laptop speakers)
- [ ] WiFi/ethernet connected (for SSH access)
- [ ] `config.js` set to `MODE: 'production'`
- [ ] Test that page loads and audio plays
