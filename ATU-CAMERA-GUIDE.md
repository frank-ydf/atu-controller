# ATU-100 Camera Integration Guide

## 📹 Overview

Integrate a Raspberry Pi Camera to display the ATU-100 OLED screen live in the web interface.

**Benefits:**
- ✅ See real L/C/SWR values from ATU display
- ✅ Confirm visual state (./_ symbols)
- ✅ Remote monitoring
- ✅ Snapshot capability
- ✅ Fullscreen view

---

## 🛠️ Hardware Setup

### Required Hardware
- Raspberry Pi Camera Module (V1/V2/HQ)
- Camera ribbon cable
- Camera mount/holder pointing at ATU display

### Physical Setup
1. Connect camera ribbon cable to Pi CSI port
2. Position camera to frame ATU OLED display
3. Adjust focus (if camera supports it)
4. Ensure good lighting on display

**Recommended distance:** 10-15cm from display

---

## 🚀 Software Installation

### Quick Setup (Automated)
```bash
cd /home/pi/atu-controller
sudo ./setup-atu-camera.sh
```

### Manual Setup

#### 1. Enable Camera
```bash
sudo raspi-config
# Interface Options → Legacy Camera → Enable
sudo reboot
```

#### 2. Install Motion
```bash
sudo apt update
sudo apt install motion -y
```

#### 3. Configure Motion
```bash
sudo nano /etc/motion/motion.conf
```

**Key settings:**
```ini
daemon on
videodevice /dev/video0
width 640
height 480
framerate 10

stream_port 8081
stream_localhost off
stream_auth_method 0
stream_quality 85
stream_maxrate 10

output_pictures off
ffmpeg_output_movies off

text_left ATU-100
text_right %Y-%m-%d %H:%M:%S
```

#### 4. Enable and Start
```bash
sudo systemctl enable motion
sudo systemctl start motion
```

#### 5. Test Stream
```bash
# Local test
curl http://localhost:8081

# Browser test
firefox http://atupi.local:8081/?action=stream
```

---

## 🎨 Web UI Integration

The camera is already integrated in the ATU panel! Features:

### Display Features
- **Live stream** at ~10 FPS
- **Status indicator** (online/offline)
- **Fullscreen button** (🔍)
- **Snapshot button** (📸)
- **Automatic reconnection** on failure

### Camera Controls

**Fullscreen:**
```javascript
Click 🔍 button → Camera expands to fullscreen
```

**Snapshot:**
```javascript
Click 📸 button → Downloads PNG with timestamp
Example: atu-display-2024-12-28T14-30-00.png
```

---

## 🔧 Troubleshooting

### Camera Stream Not Showing

#### Check Camera Detection
```bash
vcgencmd get_camera
# Should output: supported=1 detected=1

ls /dev/video*
# Should show: /dev/video0
```

#### Check Motion Status
```bash
sudo systemctl status motion

# If not running:
sudo systemctl restart motion
journalctl -u motion -n 50
```

#### Test Stream Manually
```bash
curl -I http://localhost:8081/?action=stream

# Should return: HTTP/1.0 200 OK
```

### "Camera Offline" in Web UI

#### Verify Motion is Running
```bash
sudo systemctl is-active motion
# Should output: active
```

#### Check Port Accessibility
```bash
sudo netstat -tulpn | grep 8081
# Should show motion listening on port 8081
```

#### Test from Browser
```
http://atupi.local:8081/?action=stream
```

### Poor Image Quality

#### Increase Resolution
```bash
sudo nano /etc/motion/motion.conf

# Change:
width 800
height 600
stream_quality 95
```

#### Adjust Camera Focus
- If using Camera V2: Has fixed focus
- If using HQ Camera: Manually adjust lens focus ring

#### Improve Lighting
- Add LED strip near ATU display
- Adjust camera position to avoid glare

### High CPU Usage

#### Reduce Framerate
```bash
sudo nano /etc/motion/motion.conf

# Change:
framerate 5
stream_maxrate 5
```

#### Reduce Resolution
```bash
width 320
height 240
```

---

## 🎯 Optimal Settings

### Balanced (Recommended)
```ini
width 640
height 480
framerate 10
stream_quality 85
```
**CPU:** ~10-15%  
**Network:** ~500 Kbps  
**Quality:** Good

### Low Resource
```ini
width 320
height 240
framerate 5
stream_quality 70
```
**CPU:** ~5-8%  
**Network:** ~200 Kbps  
**Quality:** Acceptable

### High Quality
```ini
width 800
height 600
framerate 15
stream_quality 95
```
**CPU:** ~20-25%  
**Network:** ~1 Mbps  
**Quality:** Excellent

---

## 📊 Resource Monitor

### Check CPU Usage
```bash
top -p $(pgrep motion)
```

### Check Network Usage
```bash
sudo iftop -i wlan0
```

### Check Motion Logs
```bash
journalctl -u motion -f
```

---

## 🔒 Security (Optional)

### Add Authentication

#### Method 1: Motion Built-in Auth
```bash
sudo nano /etc/motion/motion.conf

# Add:
stream_authentication username:password
```

#### Method 2: Nginx Reverse Proxy
```nginx
location /camera/ {
  proxy_pass http://localhost:8081/;
  auth_basic "ATU Camera";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
```

---

## 🎨 Advanced Customization

### Custom Overlay Text
```bash
sudo nano /etc/motion/motion.conf

text_left IU0AVT
text_right %Y-%m-%d %H:%M:%S
```

### Motion Detection (Optional)
```ini
# Enable motion detection
emulate_motion on
threshold 1500

# Save snapshots on motion
output_pictures on
output_normal best
snapshot_filename %Y%m%d-%H%M%S-snapshot

# Snapshots directory
target_dir /home/pi/atu-snapshots
```

### Custom Resolution
```ini
# For Pi HQ Camera
width 1280
height 960

# For Pi Camera V2
width 1920
height 1080
```

---

## 📱 Mobile Access

### Adjust Layout for Mobile
The web UI automatically adapts camera size for mobile devices.

**Desktop:**
- Camera: 400px max width
- Aspect: 4:3

**Mobile:**
- Camera: 100% width
- Responsive aspect ratio

---

## 🔄 Automatic Restart on Failure

### Systemd Override
```bash
sudo systemctl edit motion
```

Add:
```ini
[Service]
Restart=always
RestartSec=10
```

### Watchdog Script (Optional)
```bash
#!/bin/bash
# /home/pi/camera-watchdog.sh

if ! curl -s http://localhost:8081 > /dev/null; then
  echo "Camera offline, restarting..."
  sudo systemctl restart motion
fi
```

Add to crontab:
```bash
crontab -e

# Add:
*/5 * * * * /home/pi/camera-watchdog.sh
```

---

## 📸 Snapshot Storage

### Auto-save Snapshots on Tune

Add to `server.js` after tune completion:
```javascript
// Optional: Save snapshot after tune
try {
  const snapshot = await axios.get('http://localhost:8081/?action=snapshot', {
    responseType: 'arraybuffer'
  });
  fs.writeFileSync(`/home/pi/tune-snapshots/tune-${Date.now()}.jpg`, snapshot.data);
} catch (err) {
  console.log('Snapshot failed:', err.message);
}
```

---

## 🎯 Tips & Tricks

### Best Camera Position
1. Distance: 10-15cm from display
2. Angle: Perpendicular to avoid glare
3. Lighting: Soft, diffused light
4. Stability: Mount camera securely

### Focus Optimization
- **V1/V2:** Fixed focus, adjust distance
- **HQ Camera:** Manual focus ring
- **Target:** OLED text should be sharp

### Network Optimization
- Use wired Ethernet if possible
- Keep framerate ≤10 FPS for stability
- Reduce quality if bandwidth limited

---

## 📊 Comparison: Camera vs I2C Sniffing

| Method | Pros | Cons |
|--------|------|------|
| **Camera** | ✅ Easy setup<br>✅ No hardware mod<br>✅ Visual feedback | ❌ Requires camera<br>❌ More CPU<br>❌ Network bandwidth |
| **I2C Sniffer** | ✅ Direct data<br>✅ Low CPU<br>✅ Programmatic | ❌ Hardware mod<br>❌ Complex setup<br>❌ No visual |

**Recommendation:** Start with camera (easier), consider I2C later if needed.

---

## ✅ Checklist

Setup:
- [ ] Camera connected and detected
- [ ] Motion installed and configured
- [ ] Stream accessible on port 8081
- [ ] Camera positioned at ATU display
- [ ] Focus adjusted (if applicable)

Web UI:
- [ ] Camera section visible in ATU panel
- [ ] Stream loading correctly
- [ ] Status shows "Live"
- [ ] Fullscreen works
- [ ] Snapshot saves correctly

Optimization:
- [ ] CPU usage acceptable (~10-15%)
- [ ] Image quality good
- [ ] No stream lag
- [ ] Auto-reconnect works

---

## 📝 Example Motion Config

Complete working config:

```ini
# /etc/motion/motion.conf
daemon on
process_id_file /var/run/motion/motion.pid

# Camera
videodevice /dev/video0
width 640
height 480
framerate 10
auto_brightness off

# Stream
stream_port 8081
stream_localhost off
stream_auth_method 0
stream_maxrate 10
stream_quality 85

# Output
output_pictures off
ffmpeg_output_movies off

# Text
text_left IU0AVT ATU-100
text_right %Y-%m-%d %H:%M:%S

# Logging
log_level 4
log_file /var/log/motion/motion.log

# Performance
emulate_motion off
despeckle_filter EedDl
```

---

**Author:** Frank IU0AVT  
**Date:** 28 December 2024  
**Feature:** Pi Camera Integration  
**Status:** Production Ready
