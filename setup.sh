#!/bin/bash
#
# Setup ATU Controller - Persistent State Directory
#

set -e

echo "🔧 ATU Controller - Setup Script"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# 1. Create persistent state directory
echo -e "${YELLOW}📁 Creating persistent state directory...${NC}"
$SUDO mkdir -p /var/lib/atu-controller
$SUDO chown pi:pi /var/lib/atu-controller
$SUDO chmod 755 /var/lib/atu-controller

if [ -d "/var/lib/atu-controller" ]; then
    echo -e "${GREEN}✅ Directory created: /var/lib/atu-controller${NC}"
else
    echo -e "${RED}❌ Failed to create directory${NC}"
    exit 1
fi

# 2. Migrate old state file if exists
if [ -f "/tmp/atu_state.txt" ]; then
    echo -e "${YELLOW}📦 Migrating old state file...${NC}"
    $SUDO cp /tmp/atu_state.txt /var/lib/atu-controller/state.txt
    $SUDO chown pi:pi /var/lib/atu-controller/state.txt
    echo -e "${GREEN}✅ State file migrated${NC}"
fi

# 3. Make scripts executable
echo -e "${YELLOW}🔧 Setting permissions...${NC}"
chmod +x atu_gpio.py
chmod +x update.sh

echo -e "${GREEN}✅ Scripts made executable${NC}"

# 4. Restart services
echo -e "${YELLOW}🔄 Restarting services...${NC}"
$SUDO systemctl restart atu-web
$SUDO systemctl restart rigctld

sleep 2

# 5. Check service status
echo ""
echo -e "${YELLOW}📊 Service Status:${NC}"

if systemctl is-active --quiet atu-web; then
    echo -e "${GREEN}✅ atu-web: running${NC}"
else
    echo -e "${RED}❌ atu-web: stopped${NC}"
    echo "   Logs: journalctl -u atu-web -n 20"
fi

if systemctl is-active --quiet rigctld; then
    echo -e "${GREEN}✅ rigctld: running${NC}"
else
    echo -e "${RED}❌ rigctld: stopped${NC}"
    echo "   Logs: journalctl -u rigctld -n 20"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "State file location: /var/lib/atu-controller/state.txt"
echo "Access interface at: http://atupi.local:3000"
echo ""
echo "Test commands:"
echo "  ./atu_gpio.py status"
echo "  ./atu_gpio.py auto"
echo "  cat /var/lib/atu-controller/state.txt"
echo ""
