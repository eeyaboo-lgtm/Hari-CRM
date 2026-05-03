"""
Hari-CRM Dashboard — Flask app
"""
import os, sys, subprocess, glob, json
from datetime import datetime
from flask import Flask, jsonify, render_template, request

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


def get_backup_info(project: str) -> dict:
    folder = os.path.join(BACKUP_BASE, project)
    files = sorted(glob.glob(os.path.join(folder, "*.py")))
    if not files:
        return {"count": 0, "latest": None, "files": []}
    latest_ts = os.path.getmtime(files[-1])
    latest_dt = datetime.utcfromtimestamp(latest_ts).strftime("%Y-%m-%d %H:%M UTC")
    return {
        "count": len(files),
        "latest": latest_dt,
        "files": [os.path.basename(f) for f in files],
    }


@app.route("/")
def index():
    backup_info = {k: get_backup_info(k) for k in PROJECTS}
    return render_template("index.html", projects=PROJECTS, backup_info=backup_info,
                           now=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))


@app.route("/api/backup", methods=["POST"])
def run_backup():
    script = os.path.join(os.path.dirname(__file__), "..", "scripts", "backup.py")
    env = os.environ.copy()
    try:
        result = subprocess.run(
            ["python3", script],
            capture_output=True, text=True, timeout=30, env=env
        )
        output = result.stdout + result.stderr
        success = result.returncode == 0
    except subprocess.TimeoutExpired:
        output = "Backup timed out after 30s"
        success = False
    return jsonify({"success": success, "output": output,
                    "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")})


@app.route("/api/health")
def health():
    import requests as req
    import time as _time
    results = {}
    for key, cfg in PROJECTS.items():
        try:
            t0 = _time.time()
            r  = req.get(cfg["live"], timeout=10, allow_redirects=True)
            ms = int((_time.time() - t0) * 1000)
            # Check backup freshness (warn if latest > 24h old)
            bi = get_backup_info(key)
            stale = False
            if bi["count"] == 0:
                stale = True
            elif bi["latest"]:
                from datetime import timezone
                lat