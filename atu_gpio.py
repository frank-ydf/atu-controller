#!/usr/bin/env python3
"""
ATU-100 GPIO Control con State Tracking
VERSIONE CORRETTA - Display logic fixed
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

# File stato (PERSISTENT - non in /tmp!)
STATE_FILE = '/var/lib/atu-controller/state.txt'

# Setup
GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup(TUNE_PIN, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(BYP_PIN, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(AUTO_PIN, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(TXREQ_PIN, GPIO.IN, pull_up_down=GPIO.PUD_OFF)

def ensure_state_dir():
    """Crea directory stato se non esiste"""
    state_dir = os.path.dirname(STATE_FILE)
    if not os.path.exists(state_dir):
        try:
            os.makedirs(state_dir, exist_ok=True)
            os.chown(state_dir, 1000, 1000)  # pi:pi
        except:
            # Fallback a /tmp se non abbiamo permessi
            global STATE_FILE
            STATE_FILE = '/tmp/atu_state.txt'

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
        # Default: manual, no bypass
        return {'auto': False, 'bypass': False}

def save_state(state):
    """Salva stato"""
    auto_str = 'AUTO' if state['auto'] else 'MANUAL'
    byp_str = 'BYPASS' if state['bypass'] else 'NORMAL'
    
    ensure_state_dir()
    
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
    """Reset ATU (L=0, C=0)"""
    print("🔄 Resetting ATU...")
    pulse_button(TUNE_PIN, 0.15)
    print("✅ ATU reset (L=0, C=0)")

def cmd_auto():
    """Toggle AUTO mode"""
    state = load_state()
    state['auto'] = not state['auto']
    
    # ✅ LOGICA CORRETTA (dal manuale N7DDC):
    # Dot (.) = AUTO mode
    # Nothing ( ) = MANUAL mode
    if state['auto']:
        print(f"🤖 Toggling to AUTO mode (.)")
    else:
        print(f"✋ Toggling to MANUAL mode (no symbol)")
    
    pulse_button(AUTO_PIN, 0.30)
    save_state(state)
    
    print(f"✅ Mode: {'AUTO (.)' if state['auto'] else 'MANUAL (no symbol)'}")

def cmd_bypass():
    """Toggle BYPASS mode"""
    state = load_state()
    state['bypass'] = not state['bypass']
    
    print(f"⏸️  Toggling BYPASS: {'ON (_)' if state['bypass'] else 'OFF'}")
    pulse_button(BYP_PIN, 0.30)
    
    save_state(state)
    print(f"✅ BYPASS mode: {'ON (_)' if state['bypass'] else 'OFF'}")

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
    
    # ✅ LOGICA CORRETTA
    if state['bypass']:
        print("⏸️  Mode: BYPASS (_)")
    elif state['auto']:
        print("🤖 Mode: AUTO (.)")
    else:
        print("✋ Mode: MANUAL (no symbol)")
    
    return {
        'tuning': tuning,
        'auto': state['auto'],
        'bypass': state['bypass']
    }

def cmd_get_state():
    """Ritorna solo stato modalità (per API)"""
    state = load_state()
    
    # Output formato parsabile
    print(f"AUTO={state['auto']}")
    print(f"BYPASS={state['bypass']}")
    
    return state

def cleanup():
    GPIO.cleanup()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: atu_gpio.py [tune|auto|bypass|reset|status|state]")
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
        else:
            print(f"❌ Unknown command: {cmd}")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted")
    finally:
        cleanup()
