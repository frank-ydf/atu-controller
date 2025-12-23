# ATU-100 Remote Controller

Web-based remote control system for ATU-100 Extended (7x7) antenna tuner integrated with Kenwood TS-590 transceiver.

## Features

- ✅ Full remote control of ATU-100 (TUNE, AUTO, BYPASS, RESET)
- ✅ Responsive web interface with real-time feedback
- ✅ Kenwood TS-590 CAT control via Hamlib
- ✅ Automatic tune sequence with FSK/RTTY carrier
- ✅ Smart polling for tune completion detection
- ✅ Persistent state across reboots
- ✅ WebSocket real-time updates for frequency/mode/power

## Hardware Requirements

- Raspberry Pi 3B (or newer)
- ATU-100 Extended (7x7) antenna tuner
- Kenwood TS-590 transceiver
- 3× 4N35 optoisolators
- Resistors: 330Ω, 2.2kΩ, 3.3kΩ
- Perfboard for assembly

## GPIO Connections

```
Raspberry Pi → ATU-100:
GPIO17 (Pin 11) → Optocoupler 1 → ATU RB1 (TUNE/RESET)
GPIO27 (Pin 13) → Optocoupler 2 → ATU RB2 (BYPASS)
GPIO10 (Pin 19) → Optocoupler 3 → ATU RB3 (AUTO)
GPIO22 (Pin 15) ← Voltage divider ← ATU RA7 (Tx_req monitor)
GND → ATU GND

Voltage Divider for RA7 (5V → 3.3V):
ATU RA7 (5V) ──[2.2kΩ]──┬── Pi GPIO22
                         │
                     [3.3kΩ]
                         │
                        GND
```

## Quick Start

### Prerequisites

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nodejs npm python3-lgpio \
                    libhamlib-utils libhamlib-dev libhamlib4
```

### Installation

```bash
# Clone repository
cd /home/pi
git clone https://github.com/frank-ydf/atu-controller.git
cd atu-controller

# Install Node.js dependencies
npm install

# Run setup script
chmod +x setup.sh
./setup.sh

# Configure systemd services
sudo cp systemd/rigctld.service /etc/systemd/system/
sudo cp systemd/atu-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rigctld atu-web
sudo systemctl start rigctld atu-web
```

### TS-590 Configuration

```
Menu → 1-9 (COM):
├─ Baud Rate: 115200
├─ Data: 8 bit
├─ Stop: 1 bit
├─ Parity: None
└─ Handshake: None

Menu → 0-9 (Extended):
├─ Ext Control: ON
└─ TXW: ON
```

## Usage

### Web Interface

Access at: `http://atupi.local:3000`

### Command Line Interface

```bash
cd /home/pi/atu-controller

# Check status
./atu_gpio.py status

# Toggle AUTO mode
./atu_gpio.py auto

# Toggle BYPASS mode
./atu_gpio.py bypass

# Manual tune
./atu_gpio.py tune

# Reset ATU (L=0, C=0)
./atu_gpio.py reset
```

### Display Symbols

| Symbol | Mode | Behavior |
|--------|------|----------|
| **(none)** | MANUAL | Press TUNE button to tune |
| **`.` (dot)** | AUTO | Auto-tune when SWR > 1.3 |
| **`_`** | BYPASS | ATU disabled (L=0, C=0) |

*Reference: N7DDC User Manual page 7*

## Update

```bash
cd /home/pi/atu-controller
./update.sh
```

The update script will:
- Check for uncommitted local changes
- Pull latest updates from GitHub
- Update Node.js dependencies
- Restart services automatically
- Verify service status

## API Endpoints

```
GET  /api/frequency        # Read frequency
POST /api/frequency        # Set frequency
GET  /api/mode             # Read mode
GET  /api/power            # Read power
POST /api/power            # Set power
POST /api/tx               # TX ON
POST /api/rx               # TX OFF
GET  /api/tx-status        # TX/RX status
POST /api/tune             # Full tune sequence (with smart polling)
POST /api/atu/auto         # Toggle AUTO mode
POST /api/atu/bypass       # Toggle BYPASS mode
POST /api/atu/reset        # Reset ATU
GET  /api/atu/status       # Tuning status
GET  /api/atu/fullstatus   # Complete status with mode
```

## Project Structure

```
atu-controller/
├── server.js              # Node.js server + WebSocket + Smart polling
├── atu_gpio.py            # GPIO control via optoisolators
├── package.json           # Node.js dependencies
├── public/
│   └── index.html         # Web interface
├── systemd/
│   ├── rigctld.service    # Hamlib service
│   └── atu-web.service    # Web server service
├── setup.sh               # Initial setup script
├── update.sh              # Update script with safety checks
└── README.md
```

## Troubleshooting

### Services not starting

```bash
# Check logs
journalctl -u atu-web -f
journalctl -u rigctld -f

# Verify ports
sudo netstat -tulpn | grep 3000  # Web server
sudo netstat -tulpn | grep 4532  # rigctld
```

### Radio not responding

```bash
# Test CAT control directly
telnet localhost 4532
f          # Read frequency
q          # Quit
```

### GPIO not working

```bash
# Test single command
./atu_gpio.py status

# Check permissions
ls -l /dev/gpiomem
```

### State file not persisting

```bash
# Verify directory exists
ls -la /var/lib/atu-controller

# If missing, run setup
./setup.sh

# Check content
cat /var/lib/atu-controller/state.txt
```

## What's New in v1.1

### Critical Fixes
- **Display logic corrected**: Dot = AUTO, nothing = MANUAL (was inverted)
- **Persistent state**: State file now saved in `/var/lib/` instead of `/tmp/`
- **Smart polling**: Tune no longer interrupted prematurely
- **Safety checks**: `update.sh` verifies local changes before updating

### Improvements
- Tune timeout increased to 30 seconds (was 20s fixed delay)
- Polling every 500ms instead of fixed 1s delay
- Improved emergency cleanup on errors
- Automatic setup of persistent directory

## Security Warning

**This interface has NO authentication.**

For public network use, add:
- Firewall to limit access
- Reverse proxy with authentication (nginx + basic auth)
- VPN for secure remote access

## License

MIT License - See LICENSE file

## Credits

- ATU-100 firmware: [N7DDC/Dfinitski](https://github.com/Dfinitski/N7DDC-ATU-100-mini-and-extended-boards)
- Hamlib: [Hamlib Project](https://hamlib.github.io/)

## Author

- GitHub: [@frank-ydf](https://github.com/frank-ydf)
- Callsign: IU0AVT

## Support

For issues and feature requests, please use [GitHub Issues](https://github.com/frank-ydf/atu-controller/issues).

---


*Version 1.1 - Display Logic Fixed - December 2025*
