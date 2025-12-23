# Changelog

## [1.1.0] - 2025-12-23

### 🔧 Fixed
- **CRITICAL**: Corretta logica display AUTO/MANUAL
  - Prima (ERRATO): Niente = AUTO, Dot = MANUAL
  - Ora (CORRETTO): **Dot (.) = AUTO**, **Niente = MANUAL**
  - Riferimento: N7DDC User Manual pag. 7
  
- **State persistente**: File stato ora salvato in `/var/lib/atu-controller/state.txt`
  - Prima: `/tmp/atu_state.txt` (cancellato al reboot)
  - Ora: `/var/lib/atu-controller/state.txt` (persiste)
  - Fallback automatico a `/tmp/` se permessi insufficienti

- **Smart polling tune**: Eliminato delay fisso 1 secondo
  - Prima: `await delay(1000)` fisso (troppo breve!)
  - Ora: Polling `Tx_req` ogni 500ms fino a tune completo
  - Timeout aumentato a 30 secondi (prima 20s implicito)

### 🚀 Added
- **setup.sh**: Script configurazione iniziale
  - Crea directory `/var/lib/atu-controller`
  - Migra vecchio state file da `/tmp/`
  - Setta permessi corretti (pi:pi)
  - Riavvia servizi automaticamente

- **update.sh migliorato**: Safety checks pre-aggiornamento
  - Verifica modifiche locali non committate
  - Stash automatico con conferma utente
  - Merge conflict detection
  - Verifica stato servizi post-update

- **Emergency cleanup**: Ripristino configurazione radio in caso errori
  - TX OFF forzato
  - Restore mode originale
  - Restore power originale

### 🎨 Changed
- **index.html**: Display symbols con colori distintivi
  - AUTO (dot): Verde (#4ade80), font 4em
  - MANUAL (none): Bianco, font 1em
  - BYPASS (underscore): Arancione (#fb923c), font 3em

- **server.js**: Endpoint `/api/atu/fullstatus` logica corretta
  - `displaySymbol = '.'` se AUTO
  - `displaySymbol = ' '` se MANUAL
  - `displaySymbol = '_'` se BYPASS

- **atu_gpio.py**: Commenti e print corretti
  - "AUTO mode (.)" invece di "AUTO mode (no symbol)"
  - "MANUAL mode (no symbol)" invece di "MANUAL mode (.)"

### 📚 Documentation
- README aggiornato con simboli display corretti
- Aggiunta sezione "Novità v1.1"
- Troubleshooting per state file non persistente
- Istruzioni setup.sh

---

## [1.0.0] - 2025-12-20 (Initial Release)

### Features
- Controllo GPIO ATU-100 (TUNE, AUTO, BYPASS, RESET)
- Web interface responsive
- CAT control TS-590 via rigctld
- FSK/RTTY carrier per tuning
- Monitoraggio Tx_req (GPIO22)
- WebSocket real-time updates
- State tracking AUTO/BYPASS

### Known Issues
- ⚠️ Display logic invertita (fixato in v1.1)
- ⚠️ State non persistente (fixato in v1.1)
- ⚠️ Tune timeout troppo breve (fixato in v1.1)
