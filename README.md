# ATU Controller + Station Control Integration

Integrazione tra ATU-100 Remote Controller e Station Control per antenna switching automatico durante il tuning.

## 📋 Panoramica

Quando viene eseguito il comando TUNE:
1. Il sistema verifica l'antenna corrente (SDR o 590)
2. Se è selezionato SDR, commuta automaticamente su 590 (HF RTX)
3. **Attende conferma fisica dal relay** prima di trasmettere
4. Esegue la sequenza di tuning con FSK carrier
5. Al termine, ripristina l'antenna originale se era SDR

## 🔧 Modifiche Hardware

**NESSUNA** - tutto via software, usa GPIO esistenti per feedback.

## 📁 File Modificati

### 1. Station Control (ESP32)
File: `station_master_8rl_v2.ino`

**Novità aggiunte:**
- `GET /api/antenna/status` - Ritorna stato antenna + verifica relay fisica
- `POST /api/antenna/590` - Switch a TS-590 (HF=1)
- `POST /api/antenna/sdr` - Switch a SDR (HF=2)

**Risposta JSON `/api/antenna/status`:**
```json
{
  "selected": "590",           // "590", "sdr", o "off"
  "relay": {
    "b1": 1,                   // Relay B1 (GPIO14) - 1=attivo
    "b2": 0,                   // Relay B2 (GPIO26) - 0=inattivo
    "c1": 0                    // Relay C1 (GPIO25) - 0=inattivo
  },
  "relay_ok": true,            // true se relay corrisponde a "selected"
  "hf_state": 1,               // 0=off, 1=RTX(590), 2=SDR
  "antenna_state": 1           // 0=off, 1=verticale, 2=longwire
}
```

**Logica relay HF:**
- **590 (RTX)**: solo B1 attivo → `relay_ok = (b1=1 && b2=0 && c1=0)`
- **SDR**: B1+B2+C1 attivi → `relay_ok = (b1=1 && b2=1 && c1=1)`
- **OFF**: tutti inattivi → `relay_ok = (b1=0 && b2=0 && c1=0)`

### 2. ATU Controller (Raspberry Pi)
File: `server_integrated.js`

**Novità aggiunte:**
- Funzione `waitForAntennaSwitch()` - Verifica relay con retry
- Endpoint `/api/tune` modificato per antenna switching
- Gestione errori e ripristino automatico

**Flusso sequenza TUNE:**
```
1. GET /api/antenna/status → salva stato corrente
2. POST /api/antenna/590 → switch a 590
3. Polling status fino a relay_ok=true (max 1s)
4. ✅ Confermato → procede con tuning
5. Sequenza FSK/RTTY normale
6. POST /api/antenna/{originale} → ripristina se era SDR
7. Polling status fino a conferma
```

## 🚀 Installazione

### Step 1: Aggiorna Station Control (ESP32)

```bash
# 1. Apri Arduino IDE
# 2. Carica station_master_8rl_v2.ino
# 3. Compila e upload su ESP32
# 4. Verifica serial monitor:
#    - "Sistema pronto"
#    - "API ATU enabled:"
```

### Step 2: Testa API Station Control

```bash
# Da Raspberry Pi, verifica connettività
curl http://radio.local/api/antenna/status

# Risposta attesa (esempio):
# {"selected":"sdr","relay":{"b1":1,"b2":1,"c1":1},"relay_ok":true,"hf_state":2,"antenna_state":1}

# Test switch a 590
curl -X POST http://radio.local/api/antenna/590

# Test switch a SDR
curl -X POST http://radio.local/api/antenna/sdr
```

### Step 3: Aggiorna ATU Controller

```bash
cd /home/pi/atu-controller

# Backup server.js attuale
cp server.js server.js.backup

# Copia nuovo server
cp /tmp/server_integrated.js server.js

# IMPORTANTE: Verifica URL Station Control
nano server.js
# Cerca: const STATION_CONTROL_URL = 'http://radio.local';
# Modifica se usi IP diretto invece di mDNS

# Riavvia servizio
sudo systemctl restart atu-web

# Verifica logs
journalctl -u atu-web -f
```

### Step 4: Verifica Integrazione

```bash
# 1. Accedi a interfaccia web
http://atupi.local:3000

# 2. Premi pulsante TUNE
# 3. Verifica nei log:
journalctl -u atu-web -n 50

# Output atteso:
# 🎯 Starting tune sequence with antenna switching...
# 📡 Current antenna: sdr (hf_state=2, relay_ok=true)
# 🔀 Switching to 590 for tuning...
# ⏳ Waiting relay switch... (1/10)
# ✅ Relay confirmed on 590 (relay_ok=true, hf_state=1)
# ✅ Antenna confirmed on 590, ready to tune
# [sequenza tuning normale]
# 🔀 Restoring antenna to sdr...
# ✅ Antenna restored to sdr
# ✅ Tune sequence completed
```

## 🐛 Troubleshooting

### Errore: "Station Control unreachable"

```bash
# Verifica connettività
ping radio.local

# Se mDNS non funziona, usa IP diretto
# 1. Trova IP di ESP32:
arp -a | grep radio
# oppure dal serial monitor ESP32

# 2. Modifica server.js:
const STATION_CONTROL_URL = 'http://192.168.1.XXX';

# 3. Riavvia
sudo systemctl restart atu-web
```

### Errore: "Relay switch timeout"

```bash
# 1. Verifica stato relay manualmente
curl http://radio.local/api/antenna/status

# 2. Verifica logs ESP32 (serial monitor)
# Cerca messaggi tipo:
# "🔀 API: Switching to 590 (HF=1)..."
# "✅ Switched to 590 (relay_ok=true)"

# 3. Se relay_ok=false, possibile problema hardware relay
```

### Antenna non ripristina a SDR

```bash
# Verifica manualmente
curl -X POST http://radio.local/api/antenna/sdr
curl http://radio.local/api/antenna/status

# Se relay_ok=true ma antenna non commuta:
# - Controlla alimentazione relay
# - Verifica collegamenti GPIO ESP32
```

## 📊 Tempi e Timeout

| Fase | Timeout | Retry |
|------|---------|-------|
| Switch antenna 590 | 1s | 10 × 100ms |
| Tuning ATU | 20s | 40 × 500ms |
| Restore antenna | 1s | 10 × 100ms |

**Totale sequenza normale:** ~25-30 secondi

## 🔐 Sicurezza

### Protezione contro errori

1. **Relay non conferma** → ABORT tuning, NO TX
2. **Station Control offline** → ABORT tuning
3. **Errore durante tuning** → Emergency cleanup:
   - TX OFF
   - Mode restore
   - Power restore
   - Antenna restore (se possibile)

### Test consigliati

```bash
# 1. Test con Station Control offline
sudo systemctl stop apache2  # o ferma ESP32
# Premi TUNE → deve fallire con errore chiaro

# 2. Test con antenna già su 590
curl -X POST http://radio.local/api/antenna/590
# Premi TUNE → deve procedere senza switch

# 3. Test ripristino su errore
# Durante tuning, premi Ctrl+C su journalctl
# Verifica che antenna torni su originale
```

## 📝 Log Analysis

Esempi di log corretti:

### Sequenza completa con switch
```
🎯 Starting tune sequence with antenna switching...
📡 Current antenna: sdr (hf_state=2, relay_ok=true)
🔀 Switching to 590 for tuning...
✅ Relay confirmed on 590 (relay_ok=true, hf_state=1)
💾 Saved TS-590 config: Mode=USB, Power=0.50
⚡ Setting power to 10W
📻 Switching to FSK mode
📻 TX ON (FSK carrier)
🎛️ Triggering ATU tune...
⏳ Waiting for tune completion (max 20s)...
✅ Tuning completed!
📻 TX OFF
📻 Restoring mode: USB
⚡ Restoring power
🔀 Restoring antenna to sdr...
✅ Antenna restored to sdr
✅ Tune sequence completed
```

### Sequenza senza switch (già su 590)
```
🎯 Starting tune sequence with antenna switching...
📡 Current antenna: 590 (hf_state=1, relay_ok=true)
✅ Already on 590, proceeding
[normale sequenza tune]
✅ Tune sequence completed
```

## 🎯 Vantaggi

✅ **Sicurezza**: Conferma relay PRIMA di trasmettere  
✅ **Automatismo**: Zero intervento manuale  
✅ **Robustezza**: Retry automatico e cleanup su errori  
✅ **Trasparenza**: Log dettagliati per debug  
✅ **Reversibilità**: Ripristino automatico stato originale  

## 📞 Supporto

GitHub: https://github.com/frank-ydf/atu-controller
Branch: `integrated`

Per bug o feature request, apri una Issue su GitHub.

---

**73 de IU0AVT**
