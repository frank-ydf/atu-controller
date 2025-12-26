const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

// Configurazione Station Control
const STATION_CONTROL_URL = 'http://radio.local';  // o IP diretto se mDNS non funziona

// Connessione rigctld
let rigSocket = null;

function connectRig() {
  rigSocket = new net.Socket();
  rigSocket.connect(4532, '127.0.0.1', () => {
    console.log('✅ Connected to rigctld');
  });
  
  rigSocket.on('error', (err) => {
    console.error('❌ Rig error:', err.message);
    rigSocket = null;
    setTimeout(connectRig, 5000);
  });
  
  rigSocket.on('close', () => {
    console.log('⚠️  Rig disconnected, reconnecting...');
    rigSocket = null;
    setTimeout(connectRig, 5000);
  });
}

connectRig();

// Helper: comando rig
function rigCommand(cmd) {
  return new Promise((resolve, reject) => {
    if (!rigSocket) {
      return reject(new Error('Rig not connected'));
    }
    
    let response = '';
    let timeoutId = setTimeout(() => {
      rigSocket.removeListener('data', onData);
      reject(new Error('Timeout'));
    }, 3000);
    
    function onData(data) {
      response += data.toString();
      
      if (response.includes('\n')) {
        clearTimeout(timeoutId);
        rigSocket.removeListener('data', onData);
        const lines = response.split('\n').filter(l => l.trim());
        resolve(lines[0]);
      }
    }
    
    rigSocket.on('data', onData);
    rigSocket.write(cmd + '\n');
  });
}

// ============================================================================
// NUOVO: Helper per verifica switch relay con retry e feedback
// ============================================================================
async function waitForAntennaSwitch(expectedAntenna, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${STATION_CONTROL_URL}/api/antenna/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Verifica sia lo stato logico che il relay fisico
      if (data.selected === expectedAntenna && data.relay_ok === true) {
        console.log(`✅ Relay confirmed on ${expectedAntenna} (relay_ok=true, hf_state=${data.hf_state})`);
        return true;
      }
      
      console.log(`⏳ Waiting relay switch... (${i+1}/${maxRetries}) - selected=${data.selected}, relay_ok=${data.relay_ok}`);
      await new Promise(r => setTimeout(r, 100)); // 100ms tra tentativi
      
    } catch (err) {
      console.warn(`⚠️  Status check failed (${i+1}/${maxRetries}): ${err.message}`);
      
      // Se è l'ultimo tentativo, propaghiamo l'errore
      if (i === maxRetries - 1) {
        throw new Error(`Station Control unreachable: ${err.message}`);
      }
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.error('❌ Relay switch timeout!');
  return false;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// API: Get frequency
app.get('/api/frequency', async (req, res) => {
  try {
    const freq = await rigCommand('f');
    res.json({ frequency: parseInt(freq) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Set frequency
app.post('/api/frequency', async (req, res) => {
  try {
    await rigCommand(`F ${req.body.frequency}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get mode
app.get('/api/mode', async (req, res) => {
  try {
    const resp = await rigCommand('m');
    const mode = resp.split('\n')[0];
    res.json({ mode: mode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get power  
app.get('/api/power', async (req, res) => {
  try {
    const resp = await rigCommand('l RFPOWER');
    const power = parseFloat(resp) * 100;
    res.json({ power: Math.round(power) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Set power
app.post('/api/power', async (req, res) => {
  try {
    const power = req.body.power / 100;
    await rigCommand(`L RFPOWER ${power}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: TX on
app.post('/api/tx', async (req, res) => {
  try {
    await rigCommand('T 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: RX
app.post('/api/rx', async (req, res) => {
  try {
    await rigCommand('T 0');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get PTT status
app.get('/api/tx-status', async (req, res) => {
  try {
    const resp = await rigCommand('t');
    const ptt = parseInt(resp);
    res.json({ status: ptt === 1 ? 'TX' : 'RX' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ATU CONTROL ENDPOINTS
// ============================================================================

app.post('/api/atu/auto', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py auto', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

app.post('/api/atu/tune', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py tune', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

app.post('/api/atu/bypass', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py bypass', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

app.post('/api/atu/reset', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py reset', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

app.get('/api/atu/status', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py status', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    const isTuning = stdout.includes('TUNING');
    res.json({ 
      tuning: isTuning,
      status: isTuning ? 'TUNING' : 'READY'
    });
  });
});

// API: Get ATU full state
app.get('/api/atu/fullstatus', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py state', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const lines = stdout.split('\n');
    let autoMode = false;
    let bypassMode = false;
    
    lines.forEach(line => {
      if (line.includes('AUTO=true') || line.includes('AUTO=True')) autoMode = true;
      if (line.includes('BYPASS=true') || line.includes('BYPASS=True')) bypassMode = true;
    });
    
    exec('/home/pi/atu-controller/atu_gpio.py status', (err2, stdout2) => {
      const isTuning = stdout2 ? stdout2.includes('TUNING') : false;
      
      // Determina simbolo display
      let displaySymbol;
      if (bypassMode) {
        displaySymbol = '_';  // Bypass
      } else if (autoMode) {
        displaySymbol = ' ';  // Auto (niente)
      } else {
        displaySymbol = '.';  // Manuale (punto)
      }
      
      res.json({
        tuning: isTuning,
        auto: autoMode,
        bypass: bypassMode,
        display: displaySymbol,
        mode: bypassMode ? 'BYPASS' : (autoMode ? 'AUTO' : 'MANUAL')
      });
    });
  });
});

// ============================================================================
// API: Full tune sequence (CON ANTENNA SWITCHING E RELAY VERIFICATION)
// ============================================================================
app.post('/api/tune', async (req, res) => {
  console.log('🎯 Starting tune sequence with antenna switching...');
  
  let originalMode = null;
  let originalPower = null;
  let originalAntenna = null;
  let stationControlAvailable = true;
  
  try {
    // 0. NUOVO: Salva antenna corrente e switch a 590
    try {
      const antennaStatusResponse = await fetch(`${STATION_CONTROL_URL}/api/antenna/status`);
      
      if (!antennaStatusResponse.ok) {
        throw new Error(`Station Control HTTP ${antennaStatusResponse.status}`);
      }
      
      const antennaData = await antennaStatusResponse.json();
      originalAntenna = antennaData.selected;
      
      console.log(`📡 Current antenna: ${originalAntenna} (hf_state=${antennaData.hf_state}, relay_ok=${antennaData.relay_ok})`);
      
      if (originalAntenna !== '590') {
        console.log('🔀 Switching to 590 for tuning...');
        
        const switchResponse = await fetch(`${STATION_CONTROL_URL}/api/antenna/590`, { 
          method: 'POST' 
        });
        
        if (!switchResponse.ok) {
          throw new Error(`Switch failed: HTTP ${switchResponse.status}`);
        }
        
        // ATTESA CONFERMA RELAY (max 1s = 10 tentativi x 100ms)
        const switched = await waitForAntennaSwitch('590', 10);
        
        if (!switched) {
          throw new Error('Relay switch to 590 timeout');
        }
        
        console.log('✅ Antenna confirmed on 590, ready to tune');
        
      } else {
        console.log('✅ Already on 590, proceeding');
      }
      
    } catch (err) {
      console.error('❌ Antenna switch error:', err.message);
      stationControlAvailable = false;
      
      // ABORT se lo switch è critico
      return res.status(500).json({ 
        error: 'Antenna switch failed - ABORT tuning', 
        details: err.message,
        suggestion: 'Check Station Control availability at ' + STATION_CONTROL_URL
      });
    }
    
    // 1. Salva configurazione attuale TS-590
    const modeResp = await rigCommand('m');
    originalMode = modeResp.split('\n')[0];
    originalPower = await rigCommand('l RFPOWER');
    console.log(`💾 Saved TS-590 config: Mode=${originalMode}, Power=${originalPower}`);
    
    // 2. Set potenza tune (10W)
    console.log('⚡ Setting power to 10W');
    await rigCommand('L RFPOWER 0.10');
    await new Promise(r => setTimeout(r, 500));
    
    // 3. Passa a FSK mode (RTTY)
    console.log('📻 Switching to FSK mode');
    await rigCommand('M RTTY 0');
    await new Promise(r => setTimeout(r, 800));
    
    // 4. TX ON (in FSK trasmette automaticamente tono!)
    console.log('📻 TX ON (FSK carrier)');
    await rigCommand('T 1');
    await new Promise(r => setTimeout(r, 2000)); // Aspetta stabilizzazione carrier
    
    // 5. Trigger ATU tune
    console.log('🎛️ Triggering ATU tune...');
    await new Promise((resolve, reject) => {
      exec('/home/pi/atu-controller/atu_gpio.py tune', (err, stdout) => {
        console.log('ATU output:', stdout.trim());
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 6. Aspetta che il pulse finisca completamente
    await new Promise(r => setTimeout(r, 1000));
    
    // 7. Aspetta tune (max 20s)
    console.log('⏳ Waiting for tune completion (max 20s)...');
    let tuned = false;
    
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));
      
      const statusCheck = await new Promise((resolve) => {
        exec('/home/pi/atu-controller/atu_gpio.py status', (err, stdout) => {
          if (err || !stdout) {
            resolve(false);
          } else {
            resolve(!stdout.includes('TUNING'));
          }
        });
      });
      
      if (statusCheck) {
        tuned = true;
        console.log('✅ Tuning completed!');
        break;
      }
    }
    
    if (!tuned) {
      console.warn('⚠️  Tuning timeout (ATU still tuning after 20s)');
    }
    
    // 8. TX OFF
    console.log('📻 TX OFF');
    await rigCommand('T 0');
    await new Promise(r => setTimeout(r, 500));
    
    // 9. Ripristina mode originale
    console.log(`📻 Restoring mode: ${originalMode}`);
    await rigCommand(`M ${originalMode} 0`);
    await new Promise(r => setTimeout(r, 300));
    
    // 10. Ripristina potenza
    console.log('⚡ Restoring power');
    await rigCommand(`L RFPOWER ${originalPower}`);
    
    // 11. NUOVO: Ripristina antenna se necessario
    if (stationControlAvailable && originalAntenna && originalAntenna !== '590') {
      console.log(`🔀 Restoring antenna to ${originalAntenna}...`);
      
      try {
        const restoreResponse = await fetch(`${STATION_CONTROL_URL}/api/antenna/${originalAntenna}`, { 
          method: 'POST' 
        });
        
        if (!restoreResponse.ok) {
          throw new Error(`Restore failed: HTTP ${restoreResponse.status}`);
        }
        
        // Verifica switch
        const restored = await waitForAntennaSwitch(originalAntenna, 10);
        
        if (restored) {
          console.log(`✅ Antenna restored to ${originalAntenna}`);
        } else {
          console.warn(`⚠️  Antenna restore timeout (check manually)`);
        }
        
      } catch (err) {
        console.error('❌ Antenna restore error:', err.message);
      }
    }
    
    console.log('✅ Tune sequence completed');
    
    res.json({ 
      ok: true, 
      message: tuned ? 'Tuning completed successfully' : 'Tuning timeout (check antenna)',
      tuned: tuned,
      antenna_switched: stationControlAvailable,
      antenna_restored: originalAntenna !== '590'
    });
    
  } catch (err) {
    console.error('❌ Tune sequence error:', err.message);
    
    // Emergency cleanup
    try {
      console.log('🚨 Emergency cleanup...');
      
      // TX OFF
      await rigCommand('T 0');
      console.log('  ✓ TX OFF');
      
      // Restore mode
      if (originalMode) {
        await rigCommand(`M ${originalMode} 0`);
        console.log(`  ✓ Mode restored: ${originalMode}`);
      }
      
      // Restore power
      if (originalPower) {
        await rigCommand(`L RFPOWER ${originalPower}`);
        console.log('  ✓ Power restored');
      }
      
      // NUOVO: Ripristina antenna anche in caso di errore
      if (stationControlAvailable && originalAntenna && originalAntenna !== '590') {
        try {
          console.log(`  ⚠️  Attempting antenna restore to ${originalAntenna}...`);
          await fetch(`${STATION_CONTROL_URL}/api/antenna/${originalAntenna}`, { 
            method: 'POST' 
          });
          await waitForAntennaSwitch(originalAntenna, 5);
          console.log('  ✓ Antenna restored');
        } catch (restoreErr) {
          console.error('  ✗ Antenna restore failed:', restoreErr.message);
        }
      }
      
    } catch (cleanupErr) {
      console.error('  ✗ Cleanup error:', cleanupErr.message);
    }
    
    res.status(500).json({ 
      error: err.message,
      phase: 'tune_sequence',
      cleanup_attempted: true
    });
  }
});

// ============================================================================
// WebSocket updates
// ============================================================================
io.on('connection', (socket) => {
  console.log('📱 Client connected');
  
  const interval = setInterval(async () => {
    try {
      const freq = await rigCommand('f');
      const mode = await rigCommand('m');
      const powerResp = await rigCommand('l RFPOWER');
      const power = Math.round(parseFloat(powerResp) * 100);
      const pttResp = await rigCommand('t');
      const ptt = parseInt(pttResp);
      
      socket.emit('update', { 
        frequency: parseInt(freq),
        mode: mode.split('\n')[0],
        power: power,
        txStatus: ptt === 1 ? 'TX' : 'RX',
        timestamp: Date.now()
      });
    } catch (err) {
      // Ignore errors in WebSocket updates
    }
  }, 1000);
  
  socket.on('disconnect', () => {
    console.log('📱 Client disconnected');
    clearInterval(interval);
  });
});

// ============================================================================
// Server startup
// ============================================================================
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════════════════════════');
  console.log('🚀 ATU Controller Server');
  console.log('════════════════════════════════════════════════════════');
  console.log(`   Web Interface:      http://0.0.0.0:${PORT}`);
  console.log(`   Station Control:    ${STATION_CONTROL_URL}`);
  console.log('════════════════════════════════════════════════════════');
  console.log('Features:');
  console.log('  ✓ Automatic antenna switching (590/SDR)');
  console.log('  ✓ Relay feedback verification');
  console.log('  ✓ Emergency restore on errors');
  console.log('════════════════════════════════════════════════════════\n');
});
