#!/usr/bin/env python3
"""
ATU-100 GPIO Control v2.0
Simplified BYPASS/AUTO binary toggle (no MANUAL mode)
"""

import RPi.GPIO as GPIO
import time
import sys
import os

# Pin GPIO (BCM numbering) - CORRECTED MAPPING
# Based on ATU-100 schematic: RB1=AUTO, RB2=BYPASS
AUTO_PIN = 17    # GPIO17 (Pin 11) → RB1 (AUTO button)
BYP_PIN = 27     # GPIO27 (Pin 13) → RB2 (BYPASS button)  
TUNE_PIN = 10    # GPIO10 (Pin 19) → RB3 (TUNE/RESET button)
TXREQ_PIN = 22   # GPIO22 (Pin 15) ← RA7 (Tx_req monitor)

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
    
    ATU-100 parte di default in AUTO mode (. sul display).
    RB2 (BYPASS button) fa toggle diretto: AUTO (.) ⟷ BYPASS (_)
    
    Per andare in BYPASS:
    - Se ATU è in AUTO (.) → premi RB2 una volta → BYPASS (_)
    """
    print("🔧 Initializing ATU to safe state...")
    print("    Assuming ATU starts in AUTO mode (.)")
    
    # Step 1: Premi BYPASS per andare da AUTO → BYPASS
    print("    Step 1: Toggling AUTO → BYPASS...")
    pulse_button(BYP_PIN, 0.30)
    time.sleep(0.5)
    
    # Salva stato BYPASS
    state = {'auto': False, 'bypass': True}
    save_state(state)
    
    print("✅ ATU initialized to BYPASS mode (_)")

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
    Toggle AUTO mode (usando RB1)
    
    Comportamento reale:
    - MANUAL (niente) → [RB1] → AUTO (.)
    - AUTO (.) → [RB1] → MANUAL (niente)
    - BYPASS (_) → [RB1] → nessun effetto (BYPASS blocca AUTO)
    """
    state = load_state()
    
    # Se siamo in BYPASS, RB1 non ha effetto
    if state['bypass']:
        print("⚠️  Cannot toggle AUTO while in BYPASS mode")
        print("    Use 'bypass' command first to exit BYPASS")
        return
    
    # Toggle AUTO
    state['auto'] = not state['auto']
    
    if state['auto']:
        print("🤖 Enabling AUTO mode (.)")
    else:
        print("✋ Disabling AUTO mode (→ MANUAL)")
    
    pulse_button(AUTO_PIN, 0.30)
    save_state(state)
    
    if state['auto']:
        print("✅ Mode: AUTO (.)")
    else:
        print("✅ Mode: MANUAL (no symbol)")


def cmd_bypass():
    """
    Toggle BYPASS ⟷ AUTO (usando RB2)
    
    Comportamento reale scoperto:
    - AUTO (.) → [RB2] → BYPASS (_)
    - BYPASS (_) → [RB2] → AUTO (.)
    
    RB2 cicla tra AUTO e BYPASS, non passa per MANUAL
    """
    state = load_state()
    
    if state['bypass']:
        # BYPASS → AUTO
        print("🔄 BYPASS (_) → AUTO (.)")
        pulse_button(BYP_PIN, 0.30)
        state['bypass'] = False
        state['auto'] = True
    else:
        # AUTO o MANUAL → BYPASS  
        print("🔄 AUTO/MANUAL → BYPASS (_)")
        pulse_button(BYP_PIN, 0.30)
        state['bypass'] = True
        state['auto'] = False
    
    save_state(state)
    
    if state['bypass']:
        print("✅ Mode: BYPASS (_)")
    else:
        print("✅ Mode: AUTO (.)")

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
    
    # Mostra modalità corretta (3 stati)
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
    
    # Output formato JSON-like
    print(f"AUTO={state['auto']}")
    print(f"BYPASS={state['bypass']}")
    
    return state

def cmd_init():
    """Inizializza stato: ATU parte sempre in AUTO all'accensione"""
    print("🔄 Initializing ATU state...")
    
    # ATU-100 hardware default = AUTO mode (no symbol on display)
    state = {
        'auto': True,
        'bypass': False
    }
    
    save_state(state)
    print("✅ State initialized: AUTO mode")
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
            cmd_init()
        else:
            print(f"❌ Unknown command: {cmd}")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted")
    finally:
        cleanup()
