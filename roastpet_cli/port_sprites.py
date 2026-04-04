import os
import re

def convert(ts_path, py_path):
    try:
        with open(ts_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract BODIES block
        bodies_match = re.search(r'const\s+BODIES\s*=\s*({[^}]*})\s*;', content)
        bodies_text = bodies_match.group(1) if bodies_match else '{}'

        # Replace [duck]: with "duck":
        bodies_text = re.sub(r'\[([a-zA-Z0-9_]+)\]:', r'"\1":', bodies_text)

        # Extract HAT_LINES block
        hats_match = re.search(r'const\s+HAT_LINES\s*=\s*({[^}]*})\s*;', content)
        hats_text = hats_match.group(1) if hats_match else '{}'

        # Write to a clean Python dictionary file
        py_code = f"""# Auto-generated from {os.path.basename(ts_path)}
BODIES = {bodies_text}
HATS = {hats_text}
EYE_OPTIONS = ['o', '-', '^', '>', '*', 'O', 'x', '<', '@']
"""
        with open(py_path, 'w', encoding='utf-8') as f:
            f.write(py_code)
        print(f'[+] Successfully parsed {os.path.basename(ts_path)} into Python!')
    except Exception as e:
        print(f'[-] Error: {str(e)}')

if __name__ == '__main__':
    ts_path = os.path.join(os.getcwd(), 'roastpet-web', 'src', 'app', 'sprites.ts')
    py_path = os.path.join(os.getcwd(), 'roastpet_cli', 'sprites.py')
    convert(ts_path, py_path)