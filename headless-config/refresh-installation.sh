#!/bin/bash
set -e

# Restart the web server
systemctl restart installation-server.service

# Give it a moment to come up
sleep 2

# Refresh the kiosk browser in the user's X session
runuser -u haidarnasralla -- env DISPLAY=:0 XAUTHORITY=/home/haidarnasralla/.Xauthority xdotool key ctrl+shift+r
