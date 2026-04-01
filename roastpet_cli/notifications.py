import subprocess


def send_desktop_nudge(title: str, message: str):
    safe_title = (title or "RoastPet").replace("'", "''")
    safe_message = (message or "").replace("'", "''")
    command = (
        "Add-Type -AssemblyName System.Windows.Forms; "
        "Add-Type -AssemblyName System.Drawing; "
        "$n = New-Object System.Windows.Forms.NotifyIcon; "
        "$n.Icon = [System.Drawing.SystemIcons]::Information; "
        "$n.BalloonTipTitle = '{title}'; "
        "$n.BalloonTipText = '{message}'; "
        "$n.Visible = $true; "
        "$n.ShowBalloonTip(5000); "
        "Start-Sleep -Seconds 6; "
        "$n.Dispose();"
    ).format(title=safe_title, message=safe_message)
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-Command", command],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass
