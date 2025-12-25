#!/usr/bin/env python3
"""
ATU-100 Display I2C Sniffer (placeholder for future implementation)
Per v2.0 utilizziamo file-based state tracking
"""

import sys

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

if __name__ == "__main__":
    state = get_atu_state()
    print(f"State: {state}")
