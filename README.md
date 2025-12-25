# ATU-100 Remote Controller v2.0 (Integrated)

> **Branch**: `v2.0-integrated`  
> **Note**: This version requires [Station Control](https://github.com/frank-ydf/station-controller) for antenna switching.  
> For standalone version without dependencies, see branch `v2.0-standalone`.

# ATU-100 Remote Controller v2.0

Sistema di controllo remoto via web per ATU-100 Extended (7x7) antenna tuner integrato con Kenwood TS-590.

## 🎯 Novità v2.0

- ✅ **Preset Tune**: 3 pulsanti con frequenze preimpostate (160m, 80m, 40m)
- ✅ **SWR Reading**: Lettura SWR via CAT durante tuning
- ✅ **Binary Toggle**: BYPASS ⟷ AUTO (eliminata modalità MANUAL)
- ✅ **Emergency Stop**: Pulsante TX stop di emergenza
- ✅ **Antenna Matrix**: Switch 2×2 integrato con Station Control
- ✅ **Station Control Integration**: Controllo remoto antenna switch via API
- ✅ **Offline Detection**: Indicatore visuale (X rossa) quando Station Control offline
- ✅ **Layout ottimizzato**: Design 2-colonne più compatto e professionale

## 📷 Features v2.0

### Interfaccia Web
- **Layout 2 colonne**: TS-590 compatto (30%) + ATU panel largo (70%)
- **Preset Tune Buttons**: 1830, 3650, 7100 kHz con auto-frequency switching
- **SWR Display**: Lettura real-time durante tuning, visualizzazione permanente
- **Mode Toggle**: Switch visuale BYPASS ⟷ AUTO
- **Emergency Stop**: Interruzione immediata TX in caso di problemi
- **Antenna Switch Matrix**: 2×2 grid per selezione antenna e radio

### Backend
- **Frequency-based tuning**: Imposta freq → tune → ripristina freq originale
- **SWR CAT reading**: Comando Hamlib `get_level SWR`
- **Smart tune polling**: Verifica completamento accordatura
- **Emergency cleanup**: Ripristino automatico in caso di errori

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

### Configura Station Control URL (Opzionale)

Se il tuo Station Control ha un hostname diverso da `radio.local`:

```bash
# Copia file di esempio
cp .env.example .env

# Modifica con il tuo URL
nano .env

# Esempio per IP statico:
# STATION_CONTROL_URL=http://192.168.1.100

# Esempio per hostname custom:
# STATION_CONTROL_URL=http://station-control.local
```

**Default**: Se non configuri nulla, userà `http://radio.local`

### (Opzionale) Configura Station Control

Se hai lo [Station Control](https://github.com/frank-ydf/station-controller) installato:

1. Assicurati che sia raggiungibile via mDNS come `radio.local`
2. L'integrazione è automatica - il matrix antenna si sincronizzerà automaticamente
3. Se Station Control è offline, apparirà una **X rossa** sopra il matrix

**Test connessione:**
```bash
curl http://radio.local/getstate
# Dovrebbe ritornare: {"antenna":1,"hf":1,"vuhf":0}
```

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
http://<hostname>.local:3000
# Example: http://atu-pi.local:3000
```

O usa l'IP diretto:
```
http://192.168.x.x:3000
```

### Preset Tune (v2.0)
1. Click su uno dei 3 preset buttons (160m, 80m, 40m)
2. Conferma operazione
3. Sistema automaticamente:
   - Salva frequenza/mode/power correnti
   - Imposta frequenza preset
   - Passa a FSK mode @ 10W
   - Trasmette carrier per tuning
   - Legge SWR finale
   - Ripristina configurazione originale

### Emergency Stop
- Pulsante **🛑 EMERGENCY STOP TX** nel box TS-590
- Interrompe immediatamente la trasmissione
- Sicurezza in caso di problemi durante tuning

### BYPASS/AUTO Toggle
- **BYPASS**: ATU disabilitato (L=0, C=0)
- **AUTO**: ATU in modalità automatica
- Click sullo switch per toggle istantaneo

### Comandi da CLI
```bash
cd /home/pi/atu-controller

# Status completo
./atu_gpio.py status

# Toggle BYPASS/AUTO
./atu_gpio.py auto

# Tune manuale
./atu_gpio.py tune

# Reset ATU (L=0, C=0)
./atu_gpio.py reset
```

## 🔄 Aggiornamento
```bash
cd /home/pi/atu-controller
git pull origin main
npm install
sudo systemctl restart atu-web rigctld
```

## 📊 Struttura File
```
atu-controller/
├── server.js              # Server Node.js + WebSocket + API v2.0
├── atu_gpio.py            # GPIO control + binary toggle v2.0
├── package.json           # Dependencies (v2.0.0)
├── public/
│   └── index.html         # Web interface v2.0 (2-column layout)
├── systemd/
│   ├── rigctld.service    # Hamlib service
│   └── atu-web.service    # Web server service v2.0
├── .gitignore
└── README.md              # This file
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
l SWR      # Leggi SWR
q          # Esci
```

### GPIO non funzionano
```bash
# Test singolo comando
./atu_gpio.py status

# Verifica permissions
ls -l /dev/gpiomem
```

### SWR non viene letto
```bash
# Verifica supporto Hamlib
rigctl -m 2031 -r /dev/ttyUSB0 -s 115200 l SWR

# Se ritorna 0.0 o errore, il TS-590 potrebbe non supportare
# il comando SWR via CAT. Verificare firmware radio.
```

## 📝 API Endpoints v2.0

### Radio Control
```
GET  /api/frequency        # Leggi frequenza
POST /api/frequency        # Imposta frequenza
GET  /api/power            # Leggi potenza
POST /api/power            # Imposta potenza
POST /api/tx               # TX ON
POST /api/rx               # TX OFF (Emergency stop)
GET  /api/tx-status        # Stato TX/RX
```

### ATU Control
```
POST /api/tune             # Tune con freq preset (body: {frequency: Hz})
POST /api/atu/toggle-mode  # Toggle BYPASS ⟷ AUTO (v2.0)
POST /api/atu/bypass       # Toggle BYPASS (legacy)
POST /api/atu/reset        # Reset ATU (L=0, C=0)
GET  /api/atu/status       # Stato tuning
GET  /api/atu/fullstatus   # Stato completo con modalità
```

### Example: Tune con preset
```bash
curl -X POST http://<your-pi>.local:3000/api/tune \
  -H "Content-Type: application/json" \
  -d '{"frequency": 1830000}'

# Response:
# {
#   "ok": true,
#   "message": "Tune OK!",
#   "tuned": true,
#   "swr": "1.2"
# }
```

## 🔐 Sicurezza

**ATTENZIONE:** Questa interfaccia NON ha autenticazione. 

Per uso su rete pubblica, aggiungi:
- Firewall per limitare accesso
- Reverse proxy con autenticazione (nginx + basic auth)
- VPN per accesso remoto sicuro

## 📋 Changelog

### v2.0.0 (2025-01-xx)
- ✨ Preset tune buttons (160m, 80m, 40m)
- ✨ SWR reading via CAT durante tuning
- ✨ Binary BYPASS/AUTO toggle (removed MANUAL)
- ✨ Emergency TX stop button
- ✨ Antenna matrix 2×2 (VERTICAL/LONG WIRE + 590/SDR)
- 🎨 New 2-column responsive layout
- 🐛 Fixed frequency restoration after tune
- 🐛 Improved error handling with emergency cleanup

### v1.0.0 (2024-12-xx)
- Initial release
- Basic ATU control via GPIO
- TS-590 CAT integration
- WebSocket real-time updates

## 📄 Licenza

MIT License - Vedi file LICENSE

## 🙏 Crediti

- ATU-100 firmware: [N7DDC/Dfinitski](https://github.com/Dfinitski/N7DDC-ATU-100-mini-and-extended-boards)
- Hamlib: [Hamlib Project](https://hamlib.github.io/)

## 📮 Contatti

- **Author**: Frank (IU0AVT)
- **GitHub**: [@frank-ydf](https://github.com/frank-ydf)
- **Project**: [atu-controller](https://github.com/frank-ydf/atu-controller)

---

**73 de IU0AVT!** 📻
