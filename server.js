require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const { exec } = require('child_process');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

// Configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    stationControlUrl: STATION_CONTROL_URL
  });
});

// Station Control configuration
const STATION_CONTROL_URL = process.env.STATION_CONTROL_URL || 'http://radio.local';

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

// API: RX (Emergency stop)
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

// API: ATU status
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
      
      res.json({
        tuning: isTuning,
        auto: autoMode,
        bypass: bypassMode,
        mode: bypassMode ? 'BYPASS' : 'AUTO'
      });
    });
  });
});

// API: Toggle BYPASS/AUTO mode (binary toggle)
app.post('/api/atu/toggle-mode', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py auto', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Read new state
    exec('/home/pi/atu-controller/atu_gpio.py state', (err2, stdout2) => {
      const isAuto = stdout2.includes('AUTO=true') || stdout2.includes('AUTO=True');
      res.json({ 
        ok: true, 
        mode: isAuto ? 'auto' : 'bypass',
        output: stdout 
      });
    });
  });
});

// API: Bypass (legacy compatibility)
app.post('/api/atu/bypass', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py bypass', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

// API: Reset
app.post('/api/atu/reset', (req, res) => {
  exec('/home/pi/atu-controller/atu_gpio.py reset', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

// API: Full tune sequence with preset frequency
app.post('/api/tune', async (req, res) => {
  const targetFreq = req.body.frequency; // Frequency in Hz
  console.log(`🎯 Starting tune sequence on ${targetFreq} Hz...`);
  
  let originalMode = null;
  let originalPower = null;
  let originalFreq = null;
  let finalSWR = null;
  
  try {
    // 0. Switch to 590 (RTX HF) for tuning using dedicated ESP32 endpoint
    console.log('🔀 Switching to 590 (RTX HF)...');
    try {
      const switchResp = await axios.post(`${STATION_CONTROL_URL}/api/antenna/590`);
      const switchData = switchResp.data;
      
      if (switchData.ok && switchData.relay_ok) {
        console.log('✅ Switched to 590, relays confirmed');
      } else {
        console.log('⚠️ Switched to 590, but relay feedback uncertain');
      }
      
      await new Promise(r => setTimeout(r, 1000)); // Wait for relay settling
    } catch (err) {
      console.log('⚠️ Station Control not available:', err.message);
      console.log('⚠️ Continuing with tune anyway (manual antenna selection required)...');
    }
    
    // 1. Save current configuration
    const modeResp = await rigCommand('m');
    originalMode = modeResp.split('\n')[0];
    originalPower = await rigCommand('l RFPOWER');
    originalFreq = await rigCommand('f');
    console.log(`💾 Saved: Freq=${originalFreq}, Mode=${originalMode}, Power=${originalPower}`);
    
    // 2. Set target frequency
    console.log(`📻 Setting frequency to ${targetFreq} Hz`);
    await rigCommand(`F ${targetFreq}`);
    await new Promise(r => setTimeout(r, 500));
    
    // 3. Set tune power (10W)
    console.log('⚡ Setting power to 10W');
    await rigCommand('L RFPOWER 0.10');
    await new Promise(r => setTimeout(r, 500));
    
    // 4. Switch to FSK mode (RTTY)
    console.log('📻 Switching to FSK mode');
    await rigCommand('M RTTY 0');
    await new Promise(r => setTimeout(r, 800));
    
    // 5. TX ON (FSK generates carrier automatically)
    console.log('📻 TX ON (FSK carrier)');
    await rigCommand('T 1');
    await new Promise(r => setTimeout(r, 2000)); // Wait for stabilization
    
    // 6. Trigger ATU tune
    console.log('🎛️ Triggering ATU...');
    await new Promise((resolve, reject) => {
      exec('/home/pi/atu-controller/atu_gpio.py tune', (err, stdout) => {
        console.log('ATU:', stdout);
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Wait for pulse to complete
    await new Promise(r => setTimeout(r, 1000));
    
    // 7. Wait for tune completion (smart polling)
    console.log('⏳ Waiting for tune...');
    let tuned = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      
      const statusCheck = await new Promise((resolve) => {
        exec('/home/pi/atu-controller/atu_gpio.py status', (err, stdout) => {
          resolve(stdout ? !stdout.includes('TUNING') : true);
        });
      });
      
      if (statusCheck) {
        tuned = true;
        console.log('✅ Tune completed');
        break;
      }
    }
    
    // 8. Read SWR before turning off TX
    try {
      const swrResp = await rigCommand('l SWR');
      finalSWR = parseFloat(swrResp).toFixed(1);
      console.log(`📊 Final SWR: ${finalSWR}`);
    } catch (err) {
      console.log('⚠️ Could not read SWR:', err.message);
      finalSWR = null;
    }
    
    // 9. TX OFF
    console.log('📻 TX OFF');
    await rigCommand('T 0');
    await new Promise(r => setTimeout(r, 500));
    
    // 10. Restore original frequency
    console.log(`📻 Restoring frequency: ${originalFreq}`);
    await rigCommand(`F ${originalFreq}`);
    await new Promise(r => setTimeout(r, 300));
    
    // 11. Restore original mode
    console.log(`📻 Restoring mode: ${originalMode}`);
    await rigCommand(`M ${originalMode} 0`);
    await new Promise(r => setTimeout(r, 300));
    
    // 12. Restore power
    console.log('⚡ Restoring power');
    await rigCommand(`L RFPOWER ${originalPower}`);
    
    console.log('✅ Sequence completed');
    
    res.json({ 
      ok: true, 
      message: tuned ? 'Tune OK!' : 'Timeout',
      tuned: tuned,
      swr: finalSWR
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
    
    // Emergency cleanup
    try {
      console.log('🚨 Emergency cleanup');
      await rigCommand('T 0'); // TX OFF
      
      if (originalFreq) {
        await rigCommand(`F ${originalFreq}`);
      }
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

// ============================================================================
// STATION CONTROL PROXY APIs
// ============================================================================

// Get station control status and state
app.get('/api/station/status', async (req, res) => {
  try {
    const response = await axios.get(`${STATION_CONTROL_URL}/getstate`, { timeout: 2000 });
    res.json({
      online: true,
      state: response.data
    });
  } catch (err) {
    res.json({
      online: false,
      state: { antenna: 0, hf: 0, vuhf: 0 }
    });
  }
});

// Send control command to station control
app.post('/api/station/control', async (req, res) => {
  const { cmd, val } = req.body;
  
  try {
    // Send command to Station Control using x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('cmd', cmd);
    params.append('val', val);
    
    await axios.post(`${STATION_CONTROL_URL}/control`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 2000
    });
    
    // Get updated state
    const response = await axios.get(`${STATION_CONTROL_URL}/getstate`, { timeout: 2000 });
    
    res.json({
      ok: true,
      state: response.data
    });
  } catch (err) {
    console.error('Station Control error:', err.message);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================================================================
// WEBSOCKET UPDATES
// ============================================================================

// WebSocket updates
io.on('connection', (socket) => {
  console.log('📱 Client connected');
  
  const interval = setInterval(async () => {
    try {
      const freq = await rigCommand('f');
      const pttResp = await rigCommand('t');
      const ptt = parseInt(pttResp);
      
      socket.emit('update', { 
        frequency: parseInt(freq),
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
  const hostname = require('os').hostname();
  console.log(`🚀 ATU Controller v2.0-integrated on http://0.0.0.0:${PORT}`);
  console.log(`   Access at: http://${hostname}.local:${PORT}`);
  console.log(`📡 Station Control URL: ${STATION_CONTROL_URL}`);
});
