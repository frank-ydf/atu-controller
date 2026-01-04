# Tune Sequence - Visual Reminder Feature

## 🎯 Filosofia

Dopo un tune, la **frequenza rimane sulla banda accordata** come promemoria visivo, mentre **antenna/mode/power vengono ripristinati**.

Questo ti permette di:
- ✅ Vedere a colpo d'occhio dove hai accordato
- ✅ Decidere se rimanere su quella banda o cambiare
- ✅ Avere un workflow più naturale

---

## 📋 Cosa Viene Ripristinato vs Mantenuto

### ✅ RIPRISTINATO (torna come prima)
- **Station Control** → SDR/590/OFF (torna dove eri)
- **Mode** → USB/LSB/CW/etc (torna mode originale)
- **Power** → Potenza originale

### 📍 MANTENUTO (visual reminder!)
- **Frequency** → Resta sulla freq di tune
- **Antenna** → Ripristinata via Station Control

---

## 🎮 Esempi Pratici

### Scenario 1: Ascolto su 20m con SDR, tune su 40m

**Prima del tune:**
```
TS-590 Display: 14.200 MHz USB
Station Control: SDR
Power: 100W
```

**Clicco: TUNE 40m (7.1 MHz)**

**Durante tune:**
```
TS-590: 7.100 MHz FSK 10W
Station Control: 590 (auto-switched)
ATU: Tuning...
```

**Dopo tune:**
```
TS-590 Display: 7.100 MHz USB    ← Freq cambiata! (visual reminder)
Station Control: SDR              ← Ripristinato!
Power: 100W                       ← Ripristinato!
```

**Beneficio:**
- Vedo subito che ho accordato su 7.1 MHz
- SDR è già riconnesso per ascolto
- Posso decidere se rimanere su 40m o tornare su 20m

---

### Scenario 2: Operativo su 80m, tune su 160m

**Prima:**
```
TS-590: 3.750 MHz LSB
Station Control: 590
Power: 50W
```

**Clicco: TUNE 160m (1.83 MHz)**

**Dopo:**
```
TS-590: 1.830 MHz LSB    ← Freq cambiata!
Station Control: 590      ← Invariato
Power: 50W                ← Ripristinato
```

**Workflow naturale:**
1. Vedo 1.830 MHz sul display
2. Decido: "OK, resto su 160m per QSO"
3. Oppure: cambio manualmente a 3.750 se voglio tornare su 80m

---

### Scenario 3: Multi-band scanning

**Workflow tipico:**
```
1. Scan su 20m con SDR
   → 14.200 MHz, SDR

2. Trovo stazione interessante su 40m
   → TUNE 40m
   → Display: 7.100 MHz, SDR ripristinato
   → QSO immediato senza cambiare freq!

3. Finito QSO, torno su 20m
   → Cambio manualmente a 14.200
   → SDR già connesso (mai scollegato)
```

---

## 🎛️ Confronto Comportamenti

### VECCHIO (prima della modifica)
```
Prima:  14.200 MHz SDR
TUNE:   7.100 MHz 590
Dopo:   14.200 MHz SDR  ← Tutto ripristinato
```
**Problema:** Devi ricordarti dove hai accordato!

### NUOVO (attuale)
```
Prima:  14.200 MHz SDR
TUNE:   7.100 MHz 590
Dopo:   7.100 MHz SDR   ← Freq resta, antenna torna!
```
**Beneficio:** Display mostra dove hai accordato!

---

## 💡 Casi d'Uso

### Use Case 1: Contest Multi-Band
```
1. Ascolto 20m con SDR
2. Band chiusa → TUNE 15m
3. Display: 21.200 MHz
4. SDR già riconnesso
5. Inizio a chiamare CQ su 15m
6. Non devo ricordare freq o switchare manualmente
```

### Use Case 2: DX Chasing
```
1. Ascolto cluster su 20m
2. Spot su 17m → TUNE 17m
3. Display: 18.100 MHz
4. Pronto per DX, SDR attivo
5. Se no copy, torno su 20m con un click
```

### Use Case 3: Net Multi-Banda
```
1. Net su 80m: 3.750 MHz
2. QSY announced: 40m
3. TUNE 40m → 7.100 MHz
4. Display conferma banda corretta
5. Pronto per net, antenna OK
```

---

## 🔧 Ripristino Manuale Frequenza

Se vuoi tornare alla freq precedente:

### Via Web UI
- Clicca sul display frequenza
- Inserisci freq originale
- Enter

### Via Radio
- VFO knob
- Oppure memory recall

### Via Preset
- Se era 20m, clicca preset 20m
- Auto-tune su freq standard

---

## ⚙️ Dettagli Tecnici

### Sequenza Restore
```javascript
// Step 10: Frequency - SKIPPED (visual reminder)
console.log('💡 Keeping tuned frequency as visual reminder');

// Step 11: Mode - RESTORED
await rigCommand(`M ${originalMode} 0`);

// Step 12: Power - RESTORED  
await rigCommand(`L RFPOWER ${originalPower}`);

// Step 13: Station Control - RESTORED
if (was_sdr) {
  await axios.post('/api/antenna/sdr');
}
```

### Emergency Cleanup
Anche in caso di errore, freq non viene ripristinata:
```javascript
catch (err) {
  await rigCommand('T 0');
  // NO freq restore
  await rigCommand(`M ${originalMode} 0`);
  // ...
}
```

---

## 🎯 Design Rationale

**Perché questo comportamento è migliore:**

1. **Visual Feedback Immediato**
   - Display mostra immediatamente dove sei accordato
   - No need to remember or check logs

2. **Workflow Naturale**
   - Tune → Freq cambia
   - Antenna torna per ascolto
   - Ready to operate immediately

3. **Flessibilità**
   - Se vuoi restare: già pronto
   - Se vuoi tornare: un click o VFO

4. **Safety**
   - Antenna ripristinata (non rischi TX su antenna sbagliata)
   - Mode ripristinato (non resti in FSK)
   - Power ripristinato (non resti a 10W)

5. **Memory Aid**
   - Display = "ultima banda accordata"
   - Utile per planning future tunes

---

## 📊 Summary

| Parametro | Comportamento | Motivo |
|-----------|--------------|---------|
| **Frequency** | ⚠️ **NON ripristinata** | Visual reminder |
| **Mode** | ✅ Ripristinato | Safety |
| **Power** | ✅ Ripristinato | Safety |
| **Station Control** | ✅ Ripristinato | Return to listening config |

**Result:** Best of both worlds! 🎉

---

**Author**: Frank IU0AVT  
**Date**: 27 December 2024  
**Feature**: Visual Reminder on Tune
