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

// Helper: comando Kenwood diretto
function kenwoodCommand(cmd) {
  return new Promise((resolve, reject) => {
    if (!rigSocket) {
      return reject(new Error('Rig not connected'));
    }
    
    let timeoutId = setTimeout(() => {
      rigSocket.removeListener('data', onData);
      reject(new Error('Timeout'));
    }, 2000);
    
    function onData() {
      clearTimeout(timeoutId);
      rigSocket.removeListener('data', onData);
      resolve();
    }
    
    rigSocket.once('data', onData);
    rigSocket.write(cmd + '\n');
  });
}

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

// API: ATU commands
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

// API: Get ATU full state (LOGICA CORRETTA)
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
      
      // LOGICA CORRETTA DISPLAY
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

// API: Full tune sequence (CON FSK/RTTY CARRIER)
app.post('/api/tune', async (req, res) => {
  console.log('🎯 Starting tune sequence...');
  
  let originalMode = null;
  let originalPower = null;
  
  try {
    // 1. Salva configurazione attuale
    const modeResp = await rigCommand('m');
    originalMode = modeResp.split('\n')[0];
    originalPower = await rigCommand('l RFPOWER');
    console.log(`💾 Saved: Mode=${originalMode}, Power=${originalPower}`);
    
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
    await new Promise(r => setTimeout(r, 2000)); // Aspetta stabilizzazione
    
    // 5. Trigger ATU tune
    console.log('🎛️ Triggering ATU...');
    await new Promise((resolve, reject) => {
      exec('/home/pi/atu-controller/atu_gpio.py tune', (err, stdout) => {
        console.log('ATU:', stdout);
        if (err) reject(err);
        else resolve();
      });
    });
    
// 6. Trigger ATU tune
console.log('🎛️ Triggering ATU...');
await new Promise((resolve, reject) => {
  exec('/home/pi/atu-controller/atu_gpio.py tune', (err, stdout) => {
    console.log('ATU:', stdout);
    if (err) reject(err);
    else resolve();
  });
});

// AGGIUNGI QUESTO: Aspetta che il pulse finisca completamente
await new Promise(r => setTimeout(r, 1000)); // 1 secondo di pausa

// 7. Aspetta tune (max 20s)
console.log('⏳ Waiting for tune...');
    
    // 7. TX OFF
    console.log('📻 TX OFF');
    await rigCommand('T 0');
    await new Promise(r => setTimeout(r, 500));
    
    // 8. Ripristina mode originale
    console.log(`📻 Restoring mode: ${originalMode}`);
    await rigCommand(`M ${originalMode} 0`);
    await new Promise(r => setTimeout(r, 300));
    
    // 9. Ripristina potenza
    console.log('⚡ Restoring power');
    await rigCommand(`L RFPOWER ${originalPower}`);
    
    console.log('✅ Sequence completed');
    
    res.json({ 
      ok: true, 
      message: tuned ? 'Tune OK!' : 'Timeout',
      tuned: tuned
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
    
    // Emergency cleanup
    try {
      console.log('🚨 Emergency cleanup');
      await rigCommand('T 0'); // TX OFF
      
      if (originalMode) {
        await rigCommand(`M ${originalMode} 0`);
      }
      if (originalPower) {
        await rigCommand(`L RFPOWER ${originalPower}`);
      }
    } catch {}
    
    res.status(500).json({ error: err.message });
  }
});

// WebSocket updates
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
      // Ignore
    }
  }, 1000);
  
  socket.on('disconnect', () => {
    console.log('📱 Client disconnected');
    clearInterval(interval);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server on http://0.0.0.0:${PORT}`);
});
