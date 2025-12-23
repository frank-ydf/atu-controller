# 🚀 Guida Installazione Rapida - ATU Controller v1.1

## 📦 Cosa Contiene Questo Pacchetto

```
atu-controller-v1.1/
├── atu_gpio.py          ✅ Controllo GPIO (FIXED)
├── server.js            ✅ Web server (FIXED)
├── index.html           ✅ Frontend (FIXED) → va in public/
├── setup.sh             🆕 Setup directory persistente
├── update.sh            🆕 Update script migliorato
├── README.md            📚 Documentazione completa
├── CHANGELOG.md         📝 Log modifiche v1.1
└── INSTALL.md           📖 Questa guida
```

## 🎯 Procedura di Installazione

### Opzione A: Fresh Install (Prima Installazione)

```bash
# 1. Clone repository GitHub
cd /home/pi
git clone https://github.com/frank-ydf/atu-controller.git
cd atu-controller

# 2. Installa dipendenze Node.js
npm install

# 3. Copia file servizi systemd
sudo cp systemd/rigctld.service /etc/systemd/system/
sudo cp systemd/atu-web.service /etc/systemd/system/

# 4. Esegui setup
chmod +x setup.sh
./setup.sh

# 5. Abilita servizi
sudo systemctl daemon-reload
sudo systemctl enable rigctld atu-web
sudo systemctl start rigctld atu-web

# 6. Verifica
./atu_gpio.py status
curl http://localhost:3000/api/atu/fullstatus
```

### Opzione B: Update da Versione Precedente

```bash
# 1. Vai nella directory esistente
cd /home/pi/atu-controller

# 2. Backup (opzionale ma consigliato)
cp atu_gpio.py atu_gpio.py.backup
cp server.js server.js.backup
cp public/index.html public/index.html.backup

# 3. Pull aggiornamenti GitHub
git pull origin main

# ⚠️ Se hai modifiche locali, git ti chiederà di stash:
# git stash
# git pull origin main
# git stash pop

# 4. Esegui update script (fa tutto automaticamente)
./update.sh

# Output atteso:
# ✅ atu-web: running
# ✅ rigctld: running
```

### Opzione C: Update Manuale (se git pull fallisce)

```bash
cd /home/pi/atu-controller

# 1. Sostituisci file uno per uno
# (usa i file dal pacchetto v1.1)
cp /path/to/download/atu_gpio.py .
cp /path/to/download/server.js .
cp /path/to/download/index.html public/
cp /path/to/download/setup.sh .
cp /path/to/download/update.sh .

# 2. Esegui setup
chmod +x setup.sh update.sh atu_gpio.py
./setup.sh

# 3. Riavvia servizi
sudo systemctl restart atu-web rigctld
```

## ✅ Verifica Post-Installazione

### Test 1: GPIO Status
```bash
cd /home/pi/atu-controller
./atu_gpio.py status

# Output atteso:
# ✅ Tuning Status: READY (Tx_req = LOW)
# ✋ Mode: MANUAL (no symbol)
```

### Test 2: Toggle AUTO
```bash
./atu_gpio.py auto

# Output atteso:
# 🤖 Toggling to AUTO mode (.)
# ✅ Mode: AUTO (.)
```

### Test 3: Verifica State Persistente
```bash
cat /var/lib/atu-controller/state.txt

# Output atteso:
# AUTO,NORMAL
# (o MANUAL,NORMAL / MANUAL,BYPASS)
```

### Test 4: API Endpoint
```bash
curl http://localhost:3000/api/atu/fullstatus

# Output atteso (esempio):
# {"tuning":false,"auto":true,"bypass":false,"display":".","mode":"AUTO"}
```

### Test 5: Web Interface
```
Apri browser:
http://atupi.local:3000

Verifica:
✅ Display ATU mostra "." verde grande (se in AUTO)
✅ Display ATU mostra "(none)" (se in MANUAL)
✅ Pulsante AUTO funziona (cambia simbolo)
✅ Pulsante TUNE parte sequenza completa
```

## 🐛 Risoluzione Problemi

### Problema: "Permission denied" su /var/lib/
```bash
sudo chown -R pi:pi /var/lib/atu-controller
sudo chmod 755 /var/lib/atu-controller
```

### Problema: Servizio atu-web non parte
```bash
# Check logs
journalctl -u atu-web -n 50

# Verifica syntax JavaScript
node --check server.js

# Se errore, reinstalla dipendenze
npm install
sudo systemctl restart atu-web
```

### Problema: Display sempre "(none)" anche in AUTO
```bash
# Verifica stato salvato
cat /var/lib/atu-controller/state.txt

# Se vuoto, inizializza manualmente:
echo "MANUAL,NORMAL" > /var/lib/atu-controller/state.txt

# Poi testa toggle:
./atu_gpio.py auto
./atu_gpio.py status  # Deve dire "AUTO (.)"
```

### Problema: Tune timeout sempre
```bash
# Verifica GPIO Tx_req
./atu_gpio.py status
# Durante tune deve mostrare "TUNING (Tx_req = HIGH)"

# Se sempre LOW:
# 1. Controlla GPIO22 collegato a RA7 ATU
# 2. Verifica voltage divider (2.2k + 3.3k)
# 3. Misura tensione GPIO22 con multimetro durante tune (~3V)
```

## 📋 Checklist Finale

Prima di considerare l'installazione completa:

- [ ] `./atu_gpio.py status` funziona
- [ ] `./atu_gpio.py auto` cambia modalità
- [ ] File `/var/lib/atu-controller/state.txt` esiste
- [ ] Servizio `atu-web` attivo: `systemctl status atu-web`
- [ ] Servizio `rigctld` attivo: `systemctl status rigctld`
- [ ] Web interface accessibile: `http://atupi.local:3000`
- [ ] Display mostra simbolo corretto (. = AUTO, none = MANUAL)
- [ ] State persiste dopo reboot: `sudo reboot` poi verifica

## 🎉 Fatto!

Se tutti i test passano, l'installazione è completa!

Prossimi passi:
1. Testa sequenza tune completa con radio
2. Verifica AUTO mode (tune automatico quando SWR > 1.3)
3. Ordina PCA9306 per I2C sniffing display (opzionale)

## 📞 Supporto

- GitHub Issues: https://github.com/frank-ydf/atu-controller/issues
- README completo: [README.md](README.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

**73 de IU1FYF!** 📻
