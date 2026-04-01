import os
import re

def convert():
    ts_path = r"c:\Users\Akarsh\OneDrive\Desktop\NEXTIDEA\src\buddy\sprites.ts"
    py_path = r"c:\Users\Akarsh\OneDrive\Desktop\NEXTIDEA\roastpet_cli\sprites.py"
    
    with open(ts_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract BODIES block
    bodies_match = re.search(r'const BODIES[^=]*=\s*({[\s\S]*?})\n\nconst', content)
    bodies_text = bodies_match.group(1) if bodies_match else "{}"
    
    # Replace [duck]: with "duck":
    bodies_text = re.sub(r'\[([a-zA-Z0-9_]+)\]:', r'"\1":', bodies_text)
    
    # Extract HAT_LINES block
    hats_match = re.search(r'const HAT_LINES[^=]*=\s*({[\s\S]*?})\n\nexport', content)
    hats_text = hats_match.group(1) if hats_match else "{}"
    
    # Write to a clean Python dictionary file
    py_code = f"""# Auto-generated from buddy/sprites.ts
    
BODIES = {bodies_text}

HATS = {hats_text}

EYE_OPTIONS = ['o', '-', '^', '>', '*', 'O', 'x', '<', '@']
"""

    with open(py_path, 'w', encoding='utf-8') as f:
        f.write(py_code)

    print("[+] Successfully parsed TypeScript sprites into Python!")

if __name__ == '__main__':
    convert()
