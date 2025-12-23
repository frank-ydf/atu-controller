#!/usr/bin/env python3
"""
ATU-100 GPIO Control con State Tracking
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
        # Default: manual, no bypass
        return {'auto': False, 'bypass': False}

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
    pulse_button(TUNE_PIN, 0.40)  # Riduci da 0.50 a 0.40
    print("✅ TUNE triggered")

def cmd_reset():
    """Reset ATU"""
    print("🔄 Resetting ATU...")
    pulse_button(TUNE_PIN, 0.15)
    print("✅ ATU reset")

def cmd_auto():
    """Toggle AUTO mode"""
    state = load_state()
    state['auto'] = not state['auto']
    
    # LOGICA INVERTITA: punto = manuale, niente = auto!
    if state['auto']:
        print(f"🤖 Toggling to AUTO mode (no symbol)")
    else:
        print(f"🤖 Toggling to MANUAL mode (.)")
    
    pulse_button(AUTO_PIN, 0.30)
    save_state(state)
    
    print(f"✅ Mode: {'AUTO (no symbol)' if state['auto'] else 'MANUAL (.)'}")

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
    
    # LOGICA CORRETTA
    if state['bypass']:
        print("⏸️  Mode: BYPASS (_)")
    elif state['auto']:
        print("🤖 Mode: AUTO (no symbol)")
    else:
        print("✋ Mode: MANUAL (.)")
    
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
