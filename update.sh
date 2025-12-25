#!/bin/bash
#
# ATU Controller - Update Script v2.0
# Aggiorna il sistema dal repository GitHub
#

set -e  # Exit on error

CURRENT_BRANCH=$(git branch --show-current)

echo "🔄 ATU Controller Update Script v2.0"
echo "===================================="
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Error: Must run from atu-controller directory${NC}"
    exit 1
fi

# Stash any local changes
echo -e "${YELLOW}📦 Saving local changes...${NC}"
git stash

# Pull latest changes
echo -e "${YELLOW}⬇️  Pulling latest changes from GitHub...${NC}"
git pull origin $(git branch --show-current)

# Restore local changes if any
if git stash list | grep -q stash; then
    echo -e "${YELLOW}📤 Restoring local changes...${NC}"
    git stash pop || true
fi

# Install/update Node dependencies
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 Updating Node.js dependencies...${NC}"
    npm install
fi

# Make scripts executable
echo -e "${YELLOW}🔧 Setting permissions...${NC}"
chmod +x atu_gpio.py
chmod +x update.sh

# Restart services
echo -e "${YELLOW}🔄 Restarting services...${NC}"
sudo systemctl restart atu-web
sudo systemctl restart rigctld

# Wait for services to start
sleep 2

# Check service status
echo ""
echo -e "${YELLOW}📊 Service Status:${NC}"
if systemctl is-active --quiet atu-web; then
    echo -e "${GREEN}✅ atu-web: running${NC}"
else
    echo -e "${RED}❌ atu-web: stopped${NC}"
    journalctl -u atu-web -n 10 --no-pager
fi

if systemctl is-active --quiet rigctld; then
    echo -e "${GREEN}✅ rigctld: running${NC}"
else
    echo -e "${RED}❌ rigctld: stopped${NC}"
    journalctl -u rigctld -n 10 --no-pager
fi

echo ""
echo -e "${GREEN}✅ Update complete! v2.0${NC}"
echo ""
echo "Access interface at: http://$(hostname).local:3000"
echo ""
echo "To view logs:"
echo "  journalctl -u atu-web -f"
echo "  journalctl -u rigctld -f"
