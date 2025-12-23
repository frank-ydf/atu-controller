#!/usr/bin/env python3
"""
ATU-100 Display I2C Sniffer
Legge lo stato del display OLED per determinare modalità ATU
"""

import smbus2
import time
import sys
import re

# I2C bus e indirizzo display OLED
I2C_BUS = 1
OLED_ADDR = 0x3C  # Indirizzo standard OLED SSD1306

def read_display_ram():
    """
    Legge la RAM del display OLED
    NOTA: Questo è un approccio semplificato.
    Il display viene scritto dal PIC, noi leggiamo lo stato.
    """
    try:
        bus = smbus2.SMBus(I2C_BUS)
        
        # Il display SSD1306 non permette lettura diretta facilmente
        # Alternativa: monitoriamo traffico I2C passivamente
        
        # WORKAROUND: Usiamo file di stato
        # Quando i comandi GPIO vengono eseguiti, aggiorniamo lo stato
        
        bus.close()
        return None
        
    except Exception as e:
        return None

def get_atu_state():
    """
    Legge stato ATU da file cache
    (aggiornato dai comandi GPIO)
    """
    try:
        with open('/tmp/atu_state.txt', 'r') as f:
            state = f.read().strip()
            return state
    except:
        return "UNKNOWN"

def parse_display_state(state):
    """
    Interpreta stato display
    Ritorna: {auto: bool, bypass: bool}
    """
    result = {
        'auto': False,
        'bypass': False
    }
    
    if 'AUTO' in state or '.' in state:
        result['auto'] = True
    
    if 'BYP' in state or 'BYPASS' in state:
        result['bypass'] = True
    
    return result

if __name__ == "__main__":
    state = get_atu_state()
    parsed = parse_display_state(state)
    
    print(f"State: {state}")
    print(f"AUTO: {'ON' if parsed['auto'] else 'OFF'}")
    print(f"BYPASS: {'ON' if parsed['bypass'] else 'OFF'}")
