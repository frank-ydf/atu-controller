# ATU-100 Remote Controller v2.0 (Standalone)

> **Branch**: `v2.0-standalone`  
> **Note**: This version does NOT include Station Control integration.  
> For automatic antenna switching, see branch `v2.0-integrated`.

Sistema di controllo remoto via web per ATU-100 Extended (7x7) antenna tuner integrato con Kenwood TS-590.

## 🎯 Features v2.0-standalone

- ✅ **Preset Tune**: 3 pulsanti con frequenze preimpostate (160m, 80m, 40m)
- ✅ **SWR Reading**: Lettura SWR via CAT durante tuning
- ✅ **Binary Toggle**: BYPASS ⟷ AUTO (eliminata modalità MANUAL)
- ✅ **Emergency Stop**: Pulsante TX stop di emergenza
- ✅ **Antenna Matrix UI**: Visual indicator (UI only, no backend control)
- ✅ **Layout ottimizzato**: Design 2-colonne responsive

## ⚠️ What's Different from Integrated Version

This standalone version:
- ❌ Does NOT control antenna switching hardware
- ❌ Does NOT require Station Control to be running
- ✅ Matrix buttons are visual only (for future manual implementation)
- ✅ Simpler setup, fewer dependencies

For full antenna switch integration → use **v2.0-integrated** branch

## 🔌 Hardware

### Componenti
- Raspberry Pi (tested on Pi 3B and Pi Zero 2W)
- ATU-100 Extended (7x7) antenna tuner
- Kenwood TS-590 transceiver
- 3× Optoisolatori 4N35
- Resistori (330Ω, 2.2kΩ, 3.3kΩ)

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

## 🚀 Installazione Rapida

```bash
cd /home/pi
git clone -b v2.0-standalone https://github.com/frank-ydf/atu-controller.git
cd atu-controller
npm install
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rigctld atu-web
```

Accedi: `http://<hostname>.local:3000` (es: `http://atu-pi.local:3000`)

## 📝 API Endpoints

### Radio Control
```
GET  /api/frequency        # Leggi frequenza
POST /api/frequency        # Imposta frequenza
POST /api/tx               # TX ON
POST /api/rx               # TX OFF (Emergency)
GET  /api/tx-status        # Stato TX/RX
```

### ATU Control
```
POST /api/tune             # Tune con freq preset {frequency: Hz}
POST /api/atu/toggle-mode  # Toggle BYPASS ⟷ AUTO
POST /api/atu/reset        # Reset ATU
GET  /api/atu/status       # Stato tuning
GET  /api/atu/fullstatus   # Stato completo
```

## 🔄 Aggiornamento

```bash
cd /home/pi/atu-controller
git pull origin v2.0-standalone
npm install
sudo systemctl restart atu-web rigctld
```

## 📄 Licenza

MIT License

## 📮 Contatti

- **Author**: Frank (IU0AVT)
- **GitHub**: [@frank-ydf](https://github.com/frank-ydf)
- **Project**: [atu-controller](https://github.com/frank-ydf/atu-controller)

---

**73 de IU0AVT!** 📻
