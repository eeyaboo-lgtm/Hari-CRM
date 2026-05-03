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


def get_backup_info(project):
    folder = os.path.join(BACKUP_BASE, project)
    if not os.path.isdir(folder):
        return {"count": 0, "latest": None, "files": []}
    files = sorted(glob.glob(os.path.join(folder, "*.py")))
    if not files:
        return {"count": 0, "latest": None, "files": []}
    ts = os.path.getmtime(files[-1])
    dt = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M UTC")
    return {"count": len(files), "latest": dt, "files": [os.path.basename(f) for f in files]}


@app.route("/")
def index():
    backup_info = {k: get_backup_info(k) for k in PROJECTS}
    return render_template("index.html", projects=PROJECTS, backup_info=backup_info,
                           now=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))


@app.route("/api/backup", methods=["POST"])
def run_backup():
    script = os.path.join(os.path.dirname(__file__), "..", "scripts", "backup.py")
    try:
        result = subprocess.run(["python3", script], capture_output=True, text=True,
                                timeout=30, env=os.environ.copy())
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr,
                        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")})
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "output": "Timed out after 30s"})


@app.route("/api/health")
def health():
    import requests as req
    results = {}
    for key, cfg in PROJECTS.items():
        try:
            t0 = _time.time()
            r = req.get(cfg["live"], timeout=10, allow_redirects=True)
            ms = int((_time.time() - t0) * 1000)
            bi = get_backup_info(key)
            stale = bi["count"] == 0
            if not stale and bi["latest"]:
                ldt = datetime.strptime(bi["latest"], "%Y-%m-%d %H:%M UTC").replace(tzinfo=timezone.utc)
                stale = (datetime.now(timezone.utc) - ldt).total_seconds() / 3600 > 24
            results[key] = {"status": "up", "code": r.status_code, "response_ms": ms, "backup_stale": stale}
        except Exception as e:
            results[key] = {"status": "down", "error": str(e)}
    return jsonify(results)


@app.route("/api/backups")
def backup_status():
    return jsonify({k: get_backup_info(k) for k in PROJECTS})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
