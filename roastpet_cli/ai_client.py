import urllib.request
import urllib.parse
import json
import urllib.error

def analyze_code(code: str, token: str, backend_url="http://localhost:3000") -> dict:
    url = f"{backend_url}/api/roast"
    req_data = json.dumps({"token": token, "code": code}).encode('utf-8')
    
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            parsed = json.loads(body)
        except Exception:
            parsed = {"error": str(e)}
        print(f"[-] Backend connection failed: {e}")
        return parsed
    except Exception as e:
        print(f"[-] Backend connection failed: {e}")
        return {"roast": "Failed to connect to the RoastPet mothership.", "memeSound": "womp", "corrected_code": ""}
