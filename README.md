# ATU-100 Remote Controller

Sistema di controllo remoto via web per ATU-100 Extended (7x7) antenna tuner integrato con Kenwood TS-590.

## 🎯 Caratteristiche

- ✅ Controllo remoto completo ATU-100 (TUNE, AUTO, BYPASS, RESET)
- ✅ Interfaccia web responsive con feedback real-time
- ✅ Integrazione CAT control Kenwood TS-590 via Hamlib
- ✅ Sequenza tune automatica con carrier FSK/RTTY
- ✅ **Smart polling** per rilevamento fine tuning
- ✅ Monitoraggio stato accordatura (RA7)
- ✅ Tracking modalità AUTO/MANUAL/BYPASS **corretti**
- ✅ **State persistente** (sopravvive al reboot)
- ✅ WebSocket per aggiornamenti frequenza/mode/power in tempo reale

## 🔌 Hardware

### Componenti
- Raspberry Pi 3B
- ATU-100 Extended (7x7) antenna tuner
- Kenwood TS-590 transceiver
- 3× Optoisolatori 4N35
- Resistori (330Ω, 2.2kΩ, 3.3kΩ)
- Perfboard

### Collegamenti GPIO
```
Raspberry Pi → ATU-100:
GPIO17 (Pin 11) → Opto1 → ATU RB1 (TUNE/RESET)
GPIO27 (Pin 13) → Opto2 → ATU RB2 (BYPASS)
GPIO10 (Pin 19) → Opto3 → ATU RB3 (AUTO)
GPIO22 (Pin 15) ← Divisore ← ATU RA7 (Tx_req monitor)
GND → ATU GND

Divisore tensione RA7 (5V → 3.3V):
ATU RA7 (5V) ──[2.2kΩ]──┬── Pi GPIO22
                         │
                     [3.3kΩ]
                         │
                        GND
```

## 🚀 Installazione

### Prerequisiti
```bash
# Aggiorna sistema
sudo apt update && sudo apt upgrade -y

# Installa dipendenze
sudo apt install -y git vim htop python3-pip python3-venv python3-lgpio \
                    libhamlib-utils libhamlib-dev libhamlib4 nodejs npm

# Verifica versioni
node --version  # v20.x.x
rigctl --version  # Hamlib 4.x
```

### Clona Repository
```bash
cd /home/pi
git clone https://github.com/frank-ydf/atu-controller.git
cd atu-controller
```

### Installa Dipendenze Node.js
```bash
npm install
```

### **Setup Iniziale** (NUOVO!)
```bash
# Esegui setup per configurazione persistente
chmod +x setup.sh
./setup.sh
```

Questo crea:
- Directory `/var/lib/atu-controller` per state persistente
- Permessi corretti per user `pi`
- Riavvia servizi automaticamente

### Configura Servizi Systemd
```bash
# Copia file servizi
sudo cp systemd/rigctld.service /etc/systemd/system/
sudo cp systemd/atu-web.service /etc/systemd/system/

# Abilita e avvia servizi
sudo systemctl daemon-reload
sudo systemctl enable rigctld atu-web
sudo systemctl start rigctld atu-web
```

### Configura TS-590
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

## 🎮 Utilizzo

### Accedi all'interfaccia web
```
http://atupi.local:3000
```

### Comandi da CLI
```bash
cd /home/pi/atu-controller

# Status completo
./atu_gpio.py status

# Toggle AUTO mode (. ↔ niente)
./atu_gpio.py auto

# Toggle BYPASS mode (_ ↔ off)
./atu_gpio.py bypass

# Tune manuale
./atu_gpio.py tune

# Reset ATU (L=0, C=0)
./atu_gpio.py reset
```

### Simboli Display ATU-100 (✅ CORRETTI)

| Display | Modalità | Comportamento |
|---------|----------|---------------|
| **(niente)** | MANUAL | Premi TUNE per accordare |
| **`.` (dot)** | AUTO | Accorda automaticamente con carrier |
| **`_`** | BYPASS | Disabilitato (L=0, C=0) |

**Fonte**: User Manual N7DDC pag. 7

## 🔄 Aggiornamento

```bash
cd /home/pi/atu-controller
./update.sh
```

Lo script:
- ✅ Controlla modifiche locali non committate
- ✅ Fa stash automatico se necessario
- ✅ Scarica aggiornamenti da GitHub
- ✅ Aggiorna dipendenze Node.js
- ✅ Riavvia servizi automaticamente
- ✅ Verifica status servizi

## 📊 Struttura File
```
atu-controller/
├── server.js              # Server Node.js + WebSocket + Smart Polling
├── atu_gpio.py            # Controllo GPIO optoisolatori (FIXED)
├── package.json           # Dipendenze Node.js
├── public/
│   └── index.html         # Interfaccia web (FIXED)
├── systemd/
│   ├── rigctld.service    # Servizio Hamlib
│   └── atu-web.service    # Servizio web server
├── setup.sh               # Setup directory persistente (NUOVO!)
├── update.sh              # Script aggiornamento con safety checks (NUOVO!)
└── README.md
```

## 🐛 Troubleshooting

### Server non parte
```bash
# Verifica logs
journalctl -u atu-web -f
journalctl -u rigctld -f

# Verifica porte
sudo netstat -tulpn | grep 3000  # Web server
sudo netstat -tulpn | grep 4532  # rigctld
```

### Radio non risponde
```bash
# Test CAT diretto
telnet localhost 4532
f          # Leggi frequenza
q          # Esci
```

### GPIO non funzionano
```bash
# Test singolo comando
./atu_gpio.py status

# Verifica permissions
ls -l /dev/gpiomem
```

### State file non persiste
```bash
# Verifica directory esistente
ls -la /var/lib/atu-controller

# Se non esiste, esegui setup
./setup.sh

# Verifica contenuto
cat /var/lib/atu-controller/state.txt
# Output atteso: MANUAL,NORMAL  (o AUTO,NORMAL / MANUAL,BYPASS)
```

## 📝 API Endpoints
```
GET  /api/frequency        # Leggi frequenza
POST /api/frequency        # Imposta frequenza
GET  /api/mode             # Leggi mode
GET  /api/power            # Leggi potenza
POST /api/power            # Imposta potenza
POST /api/tx               # TX ON
POST /api/rx               # TX OFF
GET  /api/tx-status        # Stato TX/RX
POST /api/tune             # Sequenza tune completa (con smart polling)
POST /api/atu/auto         # Toggle AUTO
POST /api/atu/bypass       # Toggle BYPASS
POST /api/atu/reset        # Reset ATU
GET  /api/atu/status       # Stato tuning
GET  /api/atu/fullstatus   # Stato completo con modalità (FIXED)
```

## 🆕 Novità v1.1

### ✅ Fix Critici
- **Display logic corretta**: Dot = AUTO, niente = MANUAL (era invertito!)
- **State persistente**: File salvato in `/var/lib/` invece di `/tmp/`
- **Smart polling**: Tune non viene più interrotto prematuramente
- **Safety checks**: `update.sh` verifica modifiche locali prima di aggiornare

### 🚀 Miglioramenti
- Timeout tune aumentato a 30 secondi (era 20s fisso con delay)
- Polling ogni 500ms invece di delay fisso 1s
- Emergency cleanup migliorato in caso errori
- Setup automatico directory persistente

## 🔐 Sicurezza

**ATTENZIONE:** Questa interfaccia NON ha autenticazione. 

Per uso su rete pubblica, aggiungi:
- Firewall per limitare accesso
- Reverse proxy con autenticazione (nginx + basic auth)
- VPN per accesso remoto sicuro

## 📄 Licenza

MIT License - Vedi file LICENSE

## 🙏 Crediti

- ATU-100 firmware: [N7DDC/Dfinitski](https://github.com/Dfinitski/N7DDC-ATU-100-mini-and-extended-boards)
- Hamlib: [Hamlib Project](https://hamlib.github.io/)

## 📮 Contatti

- GitHub: [@frank-ydf](https://github.com/frank-ydf)
- Callsign: IU1FYF

---

**73 de IU1FYF** 📻

*Versione 1.1 - Display Logic Fixed - 2025-12-23*
