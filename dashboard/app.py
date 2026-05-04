"""
Hari-CRM Dashboard — Flask app
"""
import os, sys, subprocess, glob, time as _time
from datetime import datetime, timezone
from flask import Flask, jsonify, render_template

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

app = Flask(__name__)

BACKUP_BASE = os.path.join(os.path.dirname(__file__), "..", "backups")

PROJECTS = {
    "shelfpulse": {
        "label": "ShelfPulse",
        "live": "https://shelfpulse-j820.onrender.com/",
        "render": "https://dashboard.render.com/project/prj-d7nunhpkh4rs73bfg840",
        "github": "https://github.com/eeyaboo-lgtm/shelfpulse",
    },
    "retailsuite": {
        "label": "RetailSuite",
        "live": "https://retailsuite.onrender.com/",
        "render": "https://dashboard.render.com/project/prj-d7prlo6gvqtc73c3oo8g",
        "github": "https://github.com/eeyaboo-lgtm/retailsuite",
    },
}

# ── Scheduler state ───────────────────────────────────────────────────────────
_scheduler = None
_last_auto_backup = {"timestamp": None, "success": None, "output": ""}


def get_backup_info(project: str) -> dict:
    folder = os.path.join(BACKUP_BASE, project)
    if not os.path.isdir(folder):
        return {"count": 0, "latest": None, "files": []}
    files = sorted(glob.glob(os.path.join(folder, "*.py")))
    if not files:
        return {"count": 0, "latest": None, "files": []}
    ts = os.path.getmtime(files[-1])
    dt = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M UTC")
    return {"count": len(files), "latest": dt, "files": [os.path.basename(f) for f in files]}


def _run_backup_script() -> tuple[bool, str]:
    """Shared backup runner used by both the API endpoint and the scheduler."""
    script = os.path.join(os.path.dirname(__file__), "..", "scripts", "backup.py")
    result = subprocess.run(
        ["python3", script], capture_output=True, text=True,
        timeout=30, env=os.environ.copy()
    )
    return result.returncode == 0, result.stdout + result.stderr


def _scheduled_backup() -> None:
    """Called by APScheduler every 6 hours."""
    global _last_auto_backup
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    try:
        ok, output = _run_backup_script()
        _last_auto_backup = {"timestamp": ts, "success": ok, "output": output}
        print(f"[scheduler] Backup {'OK' if ok else 'FAILED'} at {ts}")
    except Exception as e:
        _last_auto_backup = {"timestamp": ts, "success": False, "output": str(e)}
        print(f"[scheduler] Backup ERROR at {ts}: {e}")


def _start_scheduler() -> None:
    """Start APScheduler background thread (once per process)."""
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(
            _scheduled_backup, "interval", hours=6, id="auto_backup",
            next_run_time=datetime.utcnow()  # run once immediately on boot
        )
        _scheduler.start()
        print("[scheduler] Auto-backup scheduler started (every 6h)")
    except ImportError:
        print("[scheduler] APScheduler not installed — auto-backup disabled")
    