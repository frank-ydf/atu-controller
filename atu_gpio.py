#!/usr/bin/env python3
"""
ATU-100 GPIO Control v2.0
Simplified BYPASS/AUTO binary toggle (no MANUAL mode)
"""

import RPi.GPIO as GPIO
import time
import sys
import os

# Pin GPIO (BCM numbering)
TUNE_PIN = 17
BYP_PIN = 27
AUTO_PIN = 10
TXREQ_PIN = 22

# File stato
STATE_FILE = '/tmp/atu_state.txt'

# Setup
GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup(TUNE_PIN, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(BYP_PIN, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(AUTO_PIN, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(TXREQ_PIN, GPIO.IN, pull_up_down=GPIO.PUD_OFF)

def load_state():
    """Carica stato salvato"""
    try:
        with open(STATE_FILE, 'r') as f:
            data = f.read().strip()
            parts = data.split(',')
            return {
                'auto': parts[0] == 'AUTO',
                'bypass': parts[1] == 'BYPASS'
            }
    except:
        # Default: BYPASS mode (safe startup)
        return {'auto': False, 'bypass': True}

def init_state():
    """
    Inizializza ATU allo startup in modo sicuro
    Forza BYPASS mode per sicurezza
    """
    print("🔧 Initializing ATU to safe state (BYPASS)...")
    
    # Forza BYPASS mode
    pulse_button(BYP_PIN, 0.30)
    time.sleep(0.5)
    
    # Salva stato BYPASS
    state = {'auto': False, 'bypass': True}
    save_state(state)
    
    print("✅ ATU initialized to BYPASS mode")

def save_state(state):
    """Salva stato"""
    auto_str = 'AUTO' if state['auto'] else 'MANUAL'
    byp_str = 'BYPASS' if state['bypass'] else 'NORMAL'
    with open(STATE_FILE, 'w') as f:
        f.write(f"{auto_str},{byp_str}")

def pulse_button(pin, duration=0.3):
    """Simula pressione pulsante"""
    GPIO.output(pin, GPIO.HIGH)
    time.sleep(duration)
    GPIO.output(pin, GPIO.LOW)
    time.sleep(0.1)

def cmd_tune():
    """Comando TUNE"""
    print("⚡ Triggering TUNE...")
    pulse_button(TUNE_PIN, 0.40)
    print("✅ TUNE triggered")

def cmd_reset():
    """Reset ATU"""
    print("🔄 Resetting ATU...")
    pulse_button(TUNE_PIN, 0.15)
    print("✅ ATU reset")

def cmd_auto():
    """
    Toggle AUTO/BYPASS mode (v2.0 simplified)
    BYPASS → AUTO → BYPASS
    """
    state = load_state()
    
    if state['bypass']:
        # Currently in BYPASS, switch to AUTO
        print("🔄 Switching from BYPASS to AUTO...")
        pulse_button(BYP_PIN, 0.30)  # Disable bypass
        state['bypass'] = False
        state['auto'] = True
    else:
        # Currently in AUTO, switch to BYPASS
        print("🔄 Switching from AUTO to BYPASS...")
        pulse_button(BYP_PIN, 0.30)  # Enable bypass
        state['bypass'] = True
        state['auto'] = False
    
    save_state(state)
    print(f"✅ Mode: {'BYPASS' if state['bypass'] else 'AUTO'}")

def cmd_bypass():
    """Toggle BYPASS mode (legacy compatibility)"""
    state = load_state()
    state['bypass'] = not state['bypass']
    
    print(f"⏸️  Toggling BYPASS: {'ON' if state['bypass'] else 'OFF'}")
    pulse_button(BYP_PIN, 0.30)
    
    save_state(state)
    print(f"✅ BYPASS mode: {'ON' if state['bypass'] else 'OFF'}")

def cmd_status():
    """Leggi stato completo"""
    # Stato tuning (RA7)
    txreq = GPIO.input(TXREQ_PIN)
    tuning = (txreq == GPIO.HIGH)
    
    # Stato modalità (da file)
    state = load_state()
    
    if tuning:
        print("📡 Tuning Status: TUNING (Tx_req = HIGH)")
    else:
        print("✅ Tuning Status: READY (Tx_req = LOW)")
    
    if state['bypass']:
        print("⏸️  Mode: BYPASS")
    else:
        print("🤖 Mode: AUTO")
    
    return {
        'tuning': tuning,
        'auto': state['auto'],
        'bypass': state['bypass']
    }

def cmd_get_state():
    """Ritorna solo stato modalità (per API)"""
    state = load_state()
    
    # Output formato JSON-like
    print(f"AUTO={state['auto']}")
    print(f"BYPASS={state['bypass']}")
    
    return state

def cleanup():
    GPIO.cleanup()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: atu_gpio.py [tune|auto|bypass|reset|status|state|init]")
        sys.exit(1)
    
    cmd = sys.argv[1].lower()
    
    try:
        if cmd == "tune":
            cmd_tune()
        elif cmd == "reset":
            cmd_reset()
        elif cmd == "auto":
            cmd_auto()
        elif cmd == "bypass":
            cmd_bypass()
        elif cmd == "status":
            cmd_status()
        elif cmd == "state":
            cmd_get_state()
        elif cmd == "init":
            init_state()
        else:
            print(f"❌ Unknown command: {cmd}")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted")
    finally:
        cleanup()
