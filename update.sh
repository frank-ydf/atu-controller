#!/bin/bash
#
# ATU Controller - Update Script (IMPROVED)
# Aggiorna il sistema dal repository GitHub con safety checks
#

set -e  # Exit on error

echo "🔄 ATU Controller Update Script"
echo "================================"
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

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted local changes!${NC}"
    echo ""
    git status --short
    echo ""
    read -p "Stash changes and continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Update cancelled${NC}"
        exit 1
    fi
    
    # Stash local changes
    echo -e "${YELLOW}📦 Stashing local changes...${NC}"
    git stash
fi

# Pull latest changes
echo -e "${YELLOW}⬇️  Pulling latest changes from GitHub...${NC}"
git pull origin main

# Restore stashed changes if any
if git stash list | grep -q stash; then
    echo -e "${YELLOW}📤 Restoring local changes...${NC}"
    git stash pop || {
        echo -e "${RED}❌ Merge conflict! Fix manually with:${NC}"
        echo "   git status"
        echo "   git stash drop  # to discard stashed changes"
        exit 1
    }
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
[ -f "setup.sh" ] && chmod +x setup.sh

# Run setup if setup.sh exists and state directory doesn't
if [ -f "setup.sh" ] && [ ! -d "/var/lib/atu-controller" ]; then
    echo -e "${YELLOW}🔧 Running first-time setup...${NC}"
    ./setup.sh
else
    # Just restart services
    echo -e "${YELLOW}🔄 Restarting services...${NC}"
    sudo systemctl restart atu-web
    sudo systemctl restart rigctld
    sleep 2
fi

# Check service status
echo ""
echo -e "${YELLOW}📊 Service Status:${NC}"
if systemctl is-active --quiet atu-web; then
    echo -e "${GREEN}✅ atu-web: running${NC}"
else
    echo -e "${RED}❌ atu-web: stopped${NC}"
    echo -e "${YELLOW}   Recent logs:${NC}"
    journalctl -u atu-web -n 10 --no-pager
fi

if systemctl is-active --quiet rigctld; then
    echo -e "${GREEN}✅ rigctld: running${NC}"
else
    echo -e "${RED}❌ rigctld: stopped${NC}"
    echo -e "${YELLOW}   Recent logs:${NC}"
    journalctl -u rigctld -n 10 --no-pager
fi

echo ""
echo -e "${GREEN}✅ Update complete!${NC}"
echo ""
echo "Access interface at: http://atupi.local:3000"
echo ""
echo "Quick tests:"
echo "  ./atu_gpio.py status"
echo "  ./atu_gpio.py auto"
echo "  curl http://localhost:3000/api/atu/fullstatus"
echo ""
echo "To view logs:"
echo "  journalctl -u atu-web -f"
echo "  journalctl -u rigctld -f"
echo ""
