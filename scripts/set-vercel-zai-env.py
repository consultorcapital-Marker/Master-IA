#!/usr/bin/env python3
"""Sube el .z-ai-config local como variable cifrada ZAI_CONFIG_B64 a Vercel."""
import base64
import json
import os
import sys
import urllib.request

TOKEN = os.environ.get("VERCEL_TOKEN", "")
PROJECT = "prj_HlqiUfs8SpsQTGLwMkaBA025y0Ea"
TEAM = "team_Nw3ovu08MwjpHdEARJreAtMg"
RUTA = os.path.expanduser("~/.z-ai-config")
if not os.path.exists(RUTA):
    RUTA = "/home/z/my-project/.z-ai-config"

def api(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, body) as r:
        return json.loads(r.read().decode())

def main():
    with open(RUTA, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    print(f"archivo: {RUTA} ({os.path.getsize(RUTA)} bytes)")

    # ¿Ya existe la variable?
    existing = None
    try:
        envs = api(f"https://api.vercel.com/v9/projects/{PROJECT}/env?teamId={TEAM}")
        for e in envs.get("envs", []):
            if e.get("key") == "ZAI_CONFIG_B64":
                existing = e["id"]
                break
    except Exception as e:
        print("aviso: no pude listar env vars:", e)

    payload = {
        "key": "ZAI_CONFIG_B64",
        "value": b64,
        "type": "encrypted",
        "target": ["production", "preview"],
    }
    try:
        if existing:
            api(f"https://api.vercel.com/v9/projects/{PROJECT}/env/{existing}?teamId={TEAM}",
                method="PATCH", data=payload)
            print("ZAI_CONFIG_B64 ACTUALIZADA (id", existing[:10], ")")
        else:
            api(f"https://api.vercel.com/v10/projects/{PROJECT}/env?teamId={TEAM}",
                method="POST", data=payload)
            print("ZAI_CONFIG_B64 CREADA")
    except urllib.error.HTTPError as e:
        print("ERROR HTTP:", e.code, e.read().decode()[:300])
        sys.exit(1)

if __name__ == "__main__":
    main()
