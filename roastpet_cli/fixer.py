import os

def prompt_fix(filepath: str, corrected_code: str):
    """
    Called by the UI thread when the user presses 'Y'
    """
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(corrected_code)
        print(f"[+] Successfully fixed {filepath}! Don't mess up again.")
    except Exception as e:
        print(f"[-] Could not apply fix to {filepath}: {e}")
