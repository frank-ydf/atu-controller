# ATU-100 Behavior - DEFINITIVE GUIDE ✅

## 🎯 Confirmed Behavior (27 Dec 2024)

### Physical Buttons
- **RB1** (GPIO17): AUTO button - Toggle punto (.)
- **RB2** (GPIO27): BYPASS button - Cycle AUTO ⟷ BYPASS
- **RB3** (GPIO10): TUNE/RESET button

### Display Symbols
| Display | Mode | Meaning |
|---------|------|---------|
| **(niente)** | **MANUAL** | Press TUNE to tune manually |
| **`.`** | **AUTO** | Auto-tunes when carrier detected |
| **`_`** | **BYPASS** | Disabled (L=0, C=0, pass-through) |

---

## 🔘 Button Behavior

### RB2 (BYPASS) - GPIO27
**Binary cycle** between AUTO and BYPASS:
```
AUTO (.) → [RB2 press] → BYPASS (_)
BYPASS (_) → [RB2 press] → AUTO (.)
BYPASS (_) → [RB2 press] → AUTO (.)
...repeat...
```

**Key points:**
- ✅ Cycles directly between AUTO ⟷ BYPASS
- ✅ Does NOT pass through MANUAL
- ✅ Always works regardless of current state

### RB1 (AUTO) - GPIO17
**Toggle AUTO symbol** (only when NOT in BYPASS):
```
When NOT in BYPASS:
  MANUAL (niente) → [RB1 press] → AUTO (.)
  AUTO (.) → [RB1 press] → MANUAL (niente)

When in BYPASS:
  BYPASS (_) → [RB1 press] → no effect
```

**Key points:**
- ✅ Only toggles the `.` symbol
- ✅ Blocked when in BYPASS mode
- ✅ Must exit BYPASS first (via RB2) to use RB1

### RB3 (TUNE/RESET) - GPIO10
```
Short press (0.4s)  → TUNE (start tuning sequence)
Long press (0.15s)  → RESET (L=0, C=0)
```

---

## 📊 State Machine

```
        ┌──────────┐
        │  MANUAL  │ (niente)
        │          │
        └────┬─────┘
             │
       RB1   │   RB1
         ↓   │   ↑
             │
        ┌────┴─────┐
        │   AUTO   │ (.)
        │          │
        └────┬─────┘
             │
        RB2  │   RB2
         ↓   │   ↑
             │
        ┌────┴─────┐
        │  BYPASS  │ (_)
        │          │
        └──────────┘
```

**Important:**
- MANUAL ⟷ AUTO: Use **RB1** (toggle .)
- AUTO ⟷ BYPASS: Use **RB2** (cycle)
- BYPASS ⟷ AUTO: Use **RB2** (cycle)
- BYPASS → MANUAL: Use **RB2** then **RB1**

---

## 🔌 GPIO Mapping (VERIFIED)

| GPIO Pi | Pin | Direction | ATU Pin | Function |
|---------|-----|-----------|---------|----------|
| GPIO17 | 11 | OUT | RB1 | AUTO toggle (.) |
| GPIO27 | 13 | OUT | RB2 | BYPASS cycle (_) |
| GPIO10 | 19 | OUT | RB3 | TUNE/RESET |
| GPIO22 | 15 | IN | RA7 | Tx_req monitor |

**Pulse duration:**
- AUTO toggle: 0.30s
- BYPASS toggle: 0.30s
- TUNE: 0.40s
- RESET: 0.15s

---

## 🔧 Software Implementation

### State Tracking
```python
state = {
    'auto': bool,     # True = AUTO (.), False = MANUAL (niente)
    'bypass': bool    # True = BYPASS (_), False = not bypassed
}
```

### Command Logic

#### cmd_auto() - Toggle AUTO
```python
if state['bypass']:
    print("Cannot toggle AUTO while in BYPASS")
    return  # RB1 blocked in BYPASS

state['auto'] = not state['auto']
pulse(AUTO_PIN)  # GPIO17
```

#### cmd_bypass() - Cycle AUTO ⟷ BYPASS
```python
if state['bypass']:
    # BYPASS → AUTO
    pulse(BYP_PIN)
    state['bypass'] = False
    state['auto'] = True
else:
    # AUTO/MANUAL → BYPASS
    pulse(BYP_PIN)
    state['bypass'] = True
    state['auto'] = False
```

#### cmd_tune() - Trigger tuning
```python
pulse(TUNE_PIN, duration=0.40)
# Monitor RA7 (GPIO22) for completion
```

---

## ⚡ Startup Sequence

**ATU-100 power-on default**: AUTO mode (.)

**Software initialization:**
```python
def init_state():
    # ATU starts in AUTO (.)
    
    # Single step: AUTO → BYPASS
    pulse(BYP_PIN)  # GPIO27
    
    state = {'auto': False, 'bypass': True}
    save_state(state)
    
    # Result: Display shows _
```

**Why one step?**
- RB2 cycles: AUTO (.) → BYPASS (_) directly
- No need to go through MANUAL

---

## 🎮 Usage Examples

### Scenario 1: Start in AUTO, tune, stay in AUTO
```bash
# ATU starts: AUTO (.)
./atu_gpio.py tune
# Tunes in AUTO mode
# Result: AUTO (.)
```

### Scenario 2: Force BYPASS for safety
```bash
# ATU starts: AUTO (.)
./atu_gpio.py bypass
# Result: BYPASS (_)

# Later, return to AUTO
./atu_gpio.py bypass
# Result: AUTO (.)
```

### Scenario 3: Use MANUAL mode
```bash
# ATU starts: AUTO (.)
./atu_gpio.py auto
# Result: MANUAL (niente)

# Tune manually
./atu_gpio.py tune
# Tunes once

# Back to AUTO
./atu_gpio.py auto
# Result: AUTO (.)
```

### Scenario 4: BYPASS → MANUAL
```bash
# Current: BYPASS (_)
./atu_gpio.py bypass
# Result: AUTO (.)

./atu_gpio.py auto
# Result: MANUAL (niente)
```

---

## 🧪 Testing Commands

```bash
# Check current status
./atu_gpio.py status

# Test AUTO toggle (only works if not in BYPASS)
./atu_gpio.py auto

# Test BYPASS cycle
./atu_gpio.py bypass

# Trigger tune
./atu_gpio.py tune

# Initialize to safe state
./atu_gpio.py init
```

---

## 📝 API Responses

### GET /api/atu/fullstatus
```json
{
  "tuning": false,
  "auto": true,
  "bypass": false,
  "display": ".",
  "mode": "AUTO"
}
```

**Display symbol mapping:**
- `bypass=true` → `"_"`
- `auto=true, bypass=false` → `"."`
- `auto=false, bypass=false` → `" "` (no symbol)

**Mode mapping:**
- `bypass=true` → `"BYPASS"`
- `auto=true, bypass=false` → `"AUTO"`
- `auto=false, bypass=false` → `"MANUAL"`

---

## ⚠️ Important Notes

### Issue: State inconsistency after ATU power cycle
**Problem:**
1. Software state: `bypass=True`
2. ATU powered off
3. ATU powered on → AUTO (.)
4. Software still says `bypass=True` ❌

**Solution:**
- Call `init_state()` on service start (systemd ExecStartPre)
- Forces ATU into known state (BYPASS)

### Issue: RB1 blocked in BYPASS
**Behavior:**
- Pressing RB1 while in BYPASS (_) does nothing
- Must exit BYPASS first via RB2

**Why:**
- BYPASS is exclusive state
- Cannot be AUTO and BYPASS simultaneously

### Issue: MANUAL mode tracking
**Challenge:**
- 3 states but only 2 buttons
- MANUAL = `auto=False, bypass=False`
- Implicit state, no direct button

**Solution:**
- Use RB1 to toggle AUTO on/off
- When AUTO is off (and not bypassed) = MANUAL

---

## 🔮 Future Improvements

### I2C Display Sniffing
- Read actual display state via I2C
- PCA9306 level translator (5V ↔ 3.3V)
- Monitor SSD1306 OLED commands
- 100% accurate state detection

### Power-on Detection
- Detect when ATU power cycles
- Auto-reinitialize state
- Prevent drift between software/hardware

### Secondary Display
- I2C OLED connected to Pi
- Show L, C, SWR larger
- Independent of ATU display

---

## ✅ Summary

**GPIO Mapping:**
- RB1 (GPIO17) = AUTO toggle ✅
- RB2 (GPIO27) = BYPASS cycle ✅  
- RB3 (GPIO10) = TUNE/RESET ✅

**Behavior:**
- RB2 cycles AUTO ⟷ BYPASS ✅
- RB1 toggles . on/off (when not bypassed) ✅
- 3 states: MANUAL, AUTO, BYPASS ✅

**Startup:**
- ATU defaults to AUTO (.) ✅
- Software forces BYPASS (_) via init ✅

---

**Status**: VERIFIED & DOCUMENTED ✅  
**Date**: 27 December 2024  
**Author**: Frank IU0AVT
