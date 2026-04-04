import json
import urllib.request
import urllib.parse
import urllib.error


def fetch_pet_config(token: str, backend_url="http://localhost:3000") -> dict | None:
    url = f"{backend_url}/api/pets/{token}"
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except Exception:
        return None


def fetch_voice_audio(
    token: str,
    text: str,
    species: str,
    mode: str = "ambient",
    backend_url="http://localhost:3000",
):
    url = f"{backend_url}/api/voice"
    payload = json.dumps(
        {
            "token": token,
            "text": text,
            "species": species,
            "mode": mode,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as response:
            audio = response.read()
            content_type = response.headers.get("Content-Type", "audio/mpeg")
            return {"audio": audio, "content_type": content_type}
    except Exception:
        return None


def fetch_companion_reply(
    token: str,
    message: str,
    context: str = "",
    history: list[dict] | None = None,
    backend_url="http://localhost:3000",
):
    url = f"{backend_url}/api/companion/chat"
    payload = json.dumps(
        {
            "token": token,
            "message": message,
            "context": context,
            "history": history or [],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except Exception:
        return None


def poll_remote_command(token: str, backend_url="http://localhost:3000"):
    url = f"{backend_url}/api/commands/poll?token={urllib.parse.quote(token)}"
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    try:
      with urllib.request.urlopen(req) as response:
          body = response.read().decode("utf-8")
          return json.loads(body).get("command")
    except Exception:
      return None


def plan_remote_command(token: str, text: str, context: str = "", backend_url="http://localhost:3000"):
    url = f"{backend_url}/api/commands/plan"
    payload = json.dumps({"token": token, "text": text, "context": context}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
            return json.loads(body)
        except Exception:
            return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


def update_remote_command_status(command_id: str, status: str, status_message: str, backend_url="http://localhost:3000"):
    url = f"{backend_url}/api/commands/status"
    payload = json.dumps(
        {
            "id": command_id,
            "status": status,
            "statusMessage": status_message,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except Exception:
        return None


def update_pet_presence(token: str, species: str, surface: str, status: str = "online", backend_url="http://localhost:3000"):
    url = f"{backend_url}/api/pets/presence"
    payload = json.dumps(
        {
            "token": token,
            "species": species,
            "surface": surface,
            "status": status,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except Exception:
        return None
