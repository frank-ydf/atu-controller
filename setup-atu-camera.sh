#!/bin/bash
#
# ATU Camera Setup Script
# Install and configure Motion for Pi Camera streaming
#

set -e

echo "======================================"
echo "ATU-100 Camera Setup"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Install Motion
echo -e "${YELLOW}📦 Installing Motion...${NC}"
apt update
apt install -y motion

# Backup original config
if [ ! -f /etc/motion/motion.conf.backup ]; then
  cp /etc/motion/motion.conf /etc/motion/motion.conf.backup
  echo -e "${GREEN}✅ Config backed up${NC}"
fi

# Configure Motion
echo -e "${YELLOW}🔧 Configuring Motion...${NC}"

cat > /etc/motion/motion.conf << 'EOF'
# Motion Configuration for ATU Camera
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

# Output (disabled - streaming only)
output_pictures off
ffmpeg_output_movies off

# Text overlay
text_left ATU-100
text_right %Y-%m-%d %H:%M:%S

# Logging
log_level 4
log_file /var/log/motion/motion.log

# Performance
emulate_motion off
despeckle_filter EedDl
EOF

echo -e "${GREEN}✅ Motion configured${NC}"

# Enable and start Motion
echo -e "${YELLOW}🚀 Starting Motion...${NC}"
systemctl enable motion
systemctl restart motion

# Wait for startup
sleep 2

# Check status
if systemctl is-active --quiet motion; then
  echo -e "${GREEN}✅ Motion is running${NC}"
  
  # Test stream
  if curl -s http://localhost:8081 > /dev/null; then
    echo -e "${GREEN}✅ Stream is accessible${NC}"
    echo ""
    echo -e "${GREEN}Camera stream URL:${NC}"
    echo "  http://$(hostname).local:8081/?action=stream"
  else
    echo -e "${RED}❌ Stream not accessible${NC}"
  fi
else
  echo -e "${RED}❌ Motion failed to start${NC}"
  echo "Check logs: journalctl -u motion -n 50"
  exit 1
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Point Pi Camera at ATU display"
echo "2. Test stream in browser:"
echo "   http://$(hostname).local:8081/?action=stream"
echo "3. Add camera to Web UI (see documentation)"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status motion"
echo "  sudo systemctl restart motion"
echo "  journalctl -u motion -f"
echo ""
