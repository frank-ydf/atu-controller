# ESP32 Station Control - API Reference

## 📡 Base URL
```
http://radio.local
```

## 🔌 Endpoints

### 1. Get Current State
```bash
curl http://radio.local/getstate
```

**Response:**
```json
{
  "antenna": 1,  // 0=off, 1=verticale, 2=longwire
  "hf": 1,       // 0=off, 1=RTX(590), 2=SDR
  "vuhf": 0      // 0=off, 1=RTX, 2=SDR
}
```

---

### 2. Control Command (URL-encoded)
```bash
curl -X POST http://radio.local/control \
  -d "cmd=hf&val=1"
```

**Parameters:**
- `cmd`: Comando (`antenna`, `hf`, `vuhf`, `master_off`)
- `val`: Valore (0-2)

**Examples:**
```bash
# Switch HF to 590
curl -X POST http://radio.local/control -d "cmd=hf&val=1"

# Switch HF to SDR
curl -X POST http://radio.local/control -d "cmd=hf&val=2"

# Switch antenna to VERTICAL
curl -X POST http://radio.local/control -d "cmd=antenna&val=1"

# Switch antenna to LONGWIRE
curl -X POST http://radio.local/control -d "cmd=antenna&val=2"

# Master OFF (disconnect all)
curl -X POST http://radio.local/control -d "cmd=master_off&val=0"
```

---

### 3. Get Antenna Status (with relay feedback)
```bash
curl http://radio.local/api/antenna/status
```

**Response:**
```json
{
  "selected": "590",           // "590", "sdr", or "off"
  "relay": {
    "b1": 1,                   // B1 relay state (1=active, 0=inactive)
    "b2": 0,                   // B2 relay state
    "c1": 0                    // C1 relay state
  },
  "relay_ok": true,            // true if relays match expected state
  "hf_state": 1,               // Internal state value
  "antenna_state": 1           // Antenna selection (0-2)
}
```

**Relay Configurations:**
- **590 (RTX)**: B1=ON, B2=OFF, C1=OFF
- **SDR**: B1=ON, B2=ON, C1=ON
- **OFF**: B1=OFF, B2=OFF, C1=OFF

---

### 4. Switch to 590 (Dedicated Endpoint)
```bash
curl -X POST http://radio.local/api/antenna/590
```

**Response:**
```json
{
  "ok": true,
  "selected": "590",
  "relay_ok": true,
  "hf_state": 1
}
```

**What it does:**
1. Sets `state.hf = 1`
2. If no antenna selected, auto-selects VERTICAL (`state.antenna = 1`)
3. Activates relay B1 only
4. Verifies relay configuration
5. Returns confirmation with relay feedback

---

### 5. Switch to SDR (Dedicated Endpoint)
```bash
curl -X POST http://radio.local/api/antenna/sdr
```

**Response:**
```json
{
  "ok": true,
  "selected": "sdr",
  "relay_ok": true,
  "hf_state": 2
}
```

**What it does:**
1. Sets `state.hf = 2`
2. If no antenna selected, auto-selects VERTICAL
3. Activates relays B1, B2, C1
4. If V/UHF was on SDR, disables V/UHF
5. Verifies relay configuration
6. Returns confirmation with relay feedback

---

## 🔧 Hardware Relay Mapping

| Relay | GPIO | Function | Active When |
|-------|------|----------|-------------|
| A1 | 13 | Antenna VERTICAL | antenna=1 or antenna=2 |
| A2 | 27 | Antenna LONGWIRE | antenna=2 |
| B1 | 14 | HF Common | hf=1 or hf=2 |
| B2 | 26 | HF SDR Path | hf=2 |
| C1 | 25 | SDR Common | hf=2 or vuhf=2 |
| C2 | 33 | V/UHF SDR Path | vuhf=2 |
| D1 | 32 | V/UHF RTX | vuhf=1 |
| D2 | 16 | V/UHF Common | vuhf=1 or vuhf=2 |

**Relay Logic:**
- Active = GPIO LOW
- Inactive = GPIO HIGH

---

## 🎯 Use Cases

### ATU Controller Integration

**Before Tune (switch to 590):**
```bash
curl -X POST http://radio.local/api/antenna/590
```

**After Tune (restore SDR if needed):**
```bash
curl -X POST http://radio.local/api/antenna/sdr
```

**Check status:**
```bash
curl http://radio.local/api/antenna/status
```

### Web UI Integration (JavaScript)

**Using URL-encoded:**
```javascript
const params = new URLSearchParams();
params.append('cmd', 'hf');
params.append('val', '1');

await fetch('http://radio.local/control', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: params
});
```

**Using dedicated endpoints:**
```javascript
// Switch to 590
const response = await fetch('http://radio.local/api/antenna/590', {
  method: 'POST'
});
const data = await response.json();

if (data.ok && data.relay_ok) {
  console.log('✅ Switched to 590, relays confirmed');
}
```

---

## ⚠️ Important Notes

### Content-Type Issues

**❌ WRONG - ESP32 doesn't parse JSON on /control:**
```javascript
fetch('/control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cmd: 'hf', val: 1 })
});
```

**✅ CORRECT - Use URL-encoded:**
```javascript
fetch('/control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'cmd=hf&val=1'
});
```

**✅ BETTER - Use dedicated endpoints:**
```javascript
fetch('/api/antenna/590', { method: 'POST' });
```

### Auto-antenna Selection

When switching HF, if no antenna is connected, ESP32 automatically selects VERTICAL:
```cpp
if ((state.hf == 1 || state.hf == 2) && state.antenna == 0) {
  state.antenna = 1;  // Auto-select VERTICAL
}
```

### SDR Conflict Resolution

Only one SDR connection allowed at a time:
- If HF=SDR and you switch V/UHF to SDR → HF disconnects
- If V/UHF=SDR and you switch HF to SDR → V/UHF disconnects

---

## 🧪 Testing

**Test script provided:**
```bash
./test-esp32-api.sh
```

**Manual tests:**
```bash
# 1. Check initial state
curl http://radio.local/getstate

# 2. Switch to 590
curl -X POST http://radio.local/api/antenna/590

# 3. Verify relay status
curl http://radio.local/api/antenna/status

# 4. Switch to SDR
curl -X POST http://radio.local/api/antenna/sdr

# 5. Master OFF
curl -X POST http://radio.local/control -d "cmd=master_off&val=0"
```

---

## 📝 Troubleshooting

### ESP32 not responding
```bash
ping radio.local
# If fails, use IP directly
nmap -sn 192.168.1.0/24 | grep ESP
```

### Relays not switching
```bash
# Check relay feedback
curl http://radio.local/api/antenna/status

# Look for "relay_ok": false
# Check serial monitor for relay state printout
```

### Wrong Content-Type
- Old code using JSON → Update to URL-encoded
- Or use dedicated `/api/antenna/*` endpoints

---

**Author**: Frank IU0AVT  
**Date**: 2024-12-27  
**ESP32 Firmware**: station_master_8rl_v2.ino
