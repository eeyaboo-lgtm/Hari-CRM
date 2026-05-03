"""
backup.py — Hari-CRM
Fetches app.py from ShelfPulse and RetailSuite GitHub repos.
Keeps up to MAX_BACKUPS rotating copies per project; overwrites oldest when full.
"""

import os
import requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
MAX_BACKUPS = 5

PROJECTS = {
    "shelfpulse": {
        "repo": "eeyaboo-lgtm/shelfpulse",
        "token": os.environ.get("GITHUB_TOKEN_SHELFPULSE", ""),
        "branch": "master",
        "file_path": "server.py",
    },
    "retailsuite": {
        "repo": "eeyaboo-lgtm/retailsuite",
        "token": os.environ.get("GITHUB_TOKEN_RETAILSUITE", ""),
        "branch": "main",
        "file_path": "app.py",
    },
}

BACKUP_BASE = os.path.join(os.path.dirname(__file__), "..", "backups")

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_file(repo: str, file_path: str, branch: str, token: str) -> str:
    url = f"https://api.github.com/repos/{repo}/contents/{file_path}?ref={branch}"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3.raw"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.text


def rotate_backups(backup_dir: str, project: str) -> None:
    """Remove oldest backup if we already have MAX_BACKUPS."""
    pattern = f"{project}_app_"
    files = sorted(
        [f for f in os.listdir(backup_dir) if f.startswith(pattern)],
    )
    while len(files) >= MAX_BACKUPS:
        oldest = os.path.join(backup_dir, files.pop(0))
        os.remove(oldest)
        print(f"  Removed old backup: {oldest}")


def save_backup(project: str, content: str) -> str:
    backup_dir = os.path.join(BACKUP_BASE, project)
    os.makedirs(backup_dir, exist_ok=True)
    rotate_backups(backup_dir, project)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{project}_app_{ts}.py"
    path = os.path.join(backup_dir, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    results = []
    for name, cfg in PROJECTS.items():
        print(f"\n[{name}] Fetching {cfg['file_path']} ...")
        try:
            content = fetch_file(cfg["repo"], cfg["file_path"], cfg["branch"], cfg["token"])
            saved = save_backup(name, content)
            msg = f"  ✓ Saved: {saved}"
            print(msg)
            results.append((name, True, saved))
        except Exception as e:
            msg = f"  ✗ Error: {e}"
            print(msg)
            results.append((name, False, str(e)))

    print("\n── Summary ─────────────────────────────")
    for name, ok, detail in results:
        status = "OK" if ok else "FAIL"
        print(f"  [{status}] {name}: {detail}")


if __name__ == "__main__":
    r