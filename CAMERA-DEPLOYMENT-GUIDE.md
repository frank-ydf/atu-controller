# ATU-100 Camera Branch - Deployment Guide

## 🎯 Branch: switch+atu+camera

Versione completa con:
- ✅ ATU-100 GPIO control (3-state: MANUAL/AUTO/BYPASS)
- ✅ ESP32 Station Control integration
- ✅ Pi Camera live streaming
- ✅ Web UI completa

---

## 🚀 Quick Deployment

### Step 1: Deploy Package
```bash
cd /home/pi

# Backup vecchia versione (se esiste)
if [ -d "atu-controller" ]; then
  mv atu-controller atu-controller.backup-$(date +%Y%m%d-%H%M%S)
fi

# Deploy nuova versione
unzip atu-v2.0-camera-RELEASE.zip -d atu-controller
cd atu-controller
```

### Step 2: Install Dependencies
```bash
# Node.js packages
npm install

# Python packages
pip3 install --break-system-packages pillow smbus2

# Make scripts executable
chmod +x *.py *.sh
```

### Step 3: Configure Environment
```bash
# Copy and edit .env
cp .env.example .env
nano .env
```

**Set your Station Control URL:**
```bash
STATION_CONTROL_URL=http://radio.local
```

### Step 4: Setup Camera
```bash
# Run automated camera setup
sudo ./setup-atu-camera.sh

# Script will:
# - Install Motion
# - Configure MJPEG streaming
# - Enable camera
# - Start Motion service
```

### Step 5: Deploy Services
```bash
# Copy systemd services
sudo cp systemd/*.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable rigctld atu-web motion

# Start services
sudo systemctl restart rigctld atu-web motion
```

### Step 6: Verify Everything
```bash
# Check services status
sudo systemctl status rigctld
sudo systemctl status atu-web
sudo systemctl status motion

# Check logs
journalctl -u atu-web -n 20 --no-pager
journalctl -u motion -n 20 --no-pager

# Test endpoints
curl http://localhost:3000
curl http://localhost:8081/?action=stream
curl http://localhost:4532  # rigctld
```

---

## 🎥 Camera Position & Focus

### Physical Setup
1. **Mount camera** pointing at ATU OLED display
2. **Distance**: 10-15cm from display
3. **Angle**: Perpendicular to display (avoid glare)
4. **Lighting**: Soft, diffused light (no direct reflections)

### Test Camera View
```bash
# Open stream in browser
firefox http://atupi.local:8081/?action=stream
```

**Check:**
- [ ] OLED display is centered in frame
- [ ] Text is readable (L, C, SWR values)
- [ ] Mode symbol (., _) is visible
- [ ] No glare or reflections

### Adjust if Needed

**Too close/far:**
```bash
# Adjust physical camera position
# Camera V2 has fixed focus at ~15cm
```

**Image quality:**
```bash
sudo nano /etc/motion/motion.conf

# Increase resolution:
width 800
height 600
stream_quality 95

# Restart
sudo systemctl restart motion
```

---

## 🌐 Access Web Interface

### Local Network
```
http://atupi.local:3000
```

### Features Check
- [ ] TS-590 panel shows frequency/mode/power
- [ ] ATU panel shows tune buttons
- [ ] BYPASS ⟷ AUTO toggle works
- [ ] Antenna matrix shows current selection
- [ ] **Camera stream visible in ATU panel** ← NEW!
- [ ] Camera controls (🔍 fullscreen, 📸 snapshot)
- [ ] Camera status indicator (● Live / ● Offline)

---

## 🧪 Complete Test Sequence

### 1. Camera Test
```bash
# Web UI → ATU Panel
# Should see live camera feed
# Status: ● Live (green)

# Click 🔍 → Fullscreen
# Click 📸 → Download snapshot
```

### 2. GPIO Test
```bash
cd /home/pi/atu-controller

# Test AUTO toggle
./atu_gpio.py auto
# Check ATU display: . ⟷ (niente)

# Test BYPASS cycle
./atu_gpio.py bypass
# Check ATU display: cycles through states
# Camera should show display changes!

# Test TUNE
./atu_gpio.py tune
# Check ATU display: L/C change
# Camera captures the tune process!
```

### 3. Station Control Test
```bash
# Web UI → Antenna Matrix
# Click: Vertical → 590
# Verify ESP32 relays switch
# Status should show online (no red X)
```

### 4. Full Tune Sequence Test
```bash
# Web UI → TUNE 40m button

# Monitor logs:
journalctl -u atu-web -f

# Expected sequence:
# 1. Save Station Control state
# 2. Switch to 590
# 3. Tune 7.1 MHz
# 4. Restore to SDR (if was SDR)
# 5. Freq stays on 7.1 MHz (visual reminder)

# Camera should show:
# - Mode symbol changes
# - L/C values change during tune
# - SWR displayed after tune
```

---

## 📊 Performance Check

### System Resources
```bash
# Check CPU/RAM
htop

# Expected usage on Pi 3B:
# CPU: ~25-30%
# RAM: ~250-300 MB
```

### Service Status
```bash
# All services should be active
systemctl is-active rigctld   # active
systemctl is-active atu-web   # active
systemctl is-active motion    # active
```

### Network Streams
```bash
# Check open ports
sudo netstat -tulpn | grep -E "3000|4532|8081"

# Should show:
# :3000 (atu-web)
# :4532 (rigctld)
# :8081 (motion/camera)
```

---

## 🔧 Troubleshooting

### Camera Not Showing

**Check Motion:**
```bash
sudo systemctl status motion
journalctl -u motion -n 50

# If errors, restart:
sudo systemctl restart motion
```

**Check camera detection:**
```bash
vcgencmd get_camera
# Output: supported=1 detected=1

ls /dev/video0
# Should exist
```

**Test stream directly:**
```bash
curl -I http://localhost:8081/?action=stream
# Should return: HTTP/1.0 200 OK
```

### Web UI Not Loading

**Check atu-web service:**
```bash
sudo systemctl status atu-web
journalctl -u atu-web -n 50

# Common issues:
# - Port 3000 already in use
# - npm dependencies missing
# - .env file not configured
```

**Manual start (debug):**
```bash
cd /home/pi/atu-controller
node server.js

# Watch for errors
```

### Station Control Offline

**Check ESP32 connectivity:**
```bash
# Ping ESP32
ping radio.local

# Test API
curl http://radio.local/getstate
```

**Check .env configuration:**
```bash
cat .env | grep STATION_CONTROL_URL
# Should match your ESP32 hostname
```

### GPIO Not Working

**Check permissions:**
```bash
ls -l /dev/gpiomem
# Should be accessible

groups pi
# Should include 'gpio' group
```

**Test GPIO directly:**
```bash
./atu_gpio.py status
# Should show current ATU state
```

---

## 📸 Camera Features Usage

### Fullscreen View
1. Click **🔍** button in camera section
2. Camera expands to fullscreen
3. ESC to exit

### Save Snapshot
1. Click **📸** button
2. Downloads PNG: `atu-display-YYYY-MM-DDTHH-MM-SS.png`
3. Useful for documentation/logging

### Auto-reconnect
If stream drops:
- Status shows: ● Offline (red)
- Overlay: "Camera Offline"
- Automatic reconnection attempts
- No need to refresh page

---

## 🎨 Camera Customization

### Change Resolution
```bash
sudo nano /etc/motion/motion.conf

# Options:
# Low resource: 320x240
# Balanced: 640x480 (default)
# High quality: 800x600
```

### Change Frame Rate
```bash
# In motion.conf:
framerate 10        # Default
stream_maxrate 10   # Match framerate
```

### Change Quality
```bash
# In motion.conf:
stream_quality 85   # 1-100 (85 = balanced)
```

**Apply changes:**
```bash
sudo systemctl restart motion
```

---

## 🔄 Update Procedure

### Pull Updates
```bash
cd /home/pi/atu-controller

# If using git:
git pull origin switch+atu+camera

# Or via update script:
./update.sh
```

### Manual Package Update
```bash
cd /home/pi
wget https://your-repo/atu-v2.0-camera-latest.zip

# Backup current
mv atu-controller atu-controller.backup

# Deploy new
unzip atu-v2.0-camera-latest.zip -d atu-controller
cd atu-controller
npm install
sudo systemctl restart atu-web
```

---

## 📋 Checklist

### Pre-deployment
- [ ] Pi Camera connected and detected
- [ ] ESP32 Station Control accessible
- [ ] TS-590 connected via USB
- [ ] ATU-100 connected via GPIO

### Post-deployment
- [ ] All systemd services active
- [ ] Web UI accessible on port 3000
- [ ] Camera stream visible and working
- [ ] TS-590 frequency displayed correctly
- [ ] Antenna matrix functional
- [ ] GPIO commands work
- [ ] Tune sequence completes successfully
- [ ] Camera captures display changes

### Optional
- [ ] Remote access configured (VPN/port forward)
- [ ] Backup cron job created
- [ ] Documentation reviewed
- [ ] GitHub repo updated

---

## 🎯 Success Criteria

You'll know everything works when:

1. **Web UI loads** at http://atupi.local:3000
2. **Camera shows ATU display** live in browser
3. **Toggle BYPASS** → Camera shows `_` symbol
4. **Toggle AUTO** → Camera shows `.` symbol  
5. **Click TUNE 40m** → Camera shows tuning process
6. **Antenna matrix** switches successfully
7. **All services** running stable

---

## 📚 Documentation Reference

- **ATU-CAMERA-GUIDE.md** - Complete camera setup
- **TUNE-VISUAL-REMINDER.md** - Tune sequence behavior
- **ATU-BEHAVIOR-DEFINITIVE.md** - Button behavior
- **ESP32-API-REFERENCE.md** - Station Control API
- **README.md** - Project overview

---

## 🆘 Support

### Logs to Check
```bash
# ATU Web Server
journalctl -u atu-web -f

# Camera Stream
journalctl -u motion -f

# Hamlib CAT
journalctl -u rigctld -f
```

### Debug Mode
```bash
# Stop service
sudo systemctl stop atu-web

# Run manually to see errors
cd /home/pi/atu-controller
node server.js
```

### GitHub Issues
If you find bugs or have suggestions:
```
https://github.com/frank-ydf/atu-controller/issues
```

---

**Branch:** switch+atu+camera  
**Version:** v2.0-camera-RELEASE  
**Date:** 28 December 2024  
**Status:** Production Ready 🚀

73!
