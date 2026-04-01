import ctypes
def send_desktop_nudge(title: str, message: str):
    safe_title = (title or "RoastPet").replace("'", "''")
    safe_message = (message or "").replace("'", "''")

    ctypes.windll.user32.MessageBoxW(0, message, title, 0)