#!/usr/bin/env python3
"""Crea el secreto VERCEL_TOKEN en el repo GitHub (cifrado con libsodium sealed box).

Uso (sin hardcodear secretos):
  GITHUB_TOKEN=ghp_xxx VERCEL_TOKEN=vcp_xxx python3 scripts/create-github-secret.py
"""
import base64
import json
import os
import sys
import urllib.request

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN", "")
OWNER, REPO, SECRET_NAME = "consultorcapital-Marker", "Master-IA", "VERCEL_TOKEN"

if not GITHUB_TOKEN or not VERCEL_TOKEN:
    sys.exit("Error: exporta GITHUB_TOKEN y VERCEL_TOKEN antes de ejecutar.")


def api(method: str, path: str, payload: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        method=method,
        data=json.dumps(payload).encode() if payload else None,
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as res:
        body = res.read().decode()
        return json.loads(body) if body else {}


# 1. Clave publica del repo
pk = api("GET", f"/repos/{OWNER}/{REPO}/actions/secrets/public-key")
print(f"key_id={pk['key_id']}")

# 2. Cifrar con sealed box (libsodium)
from nacl import encoding, public  # noqa: E402

pk_obj = public.PublicKey(pk["key"].encode(), encoding.Base64Encoder())
sealed = public.SealedBox(pk_obj).encrypt(VERCEL_TOKEN.encode())
encrypted = base64.b64encode(sealed).decode()

# 3. Guardar secreto
api(
    "PUT",
    f"/repos/{OWNER}/{REPO}/actions/secrets/{SECRET_NAME}",
    {"encrypted_value": encrypted, "key_id": pk["key_id"]},
)
print(f"secreto {SECRET_NAME} creado ✓")

# 4. Verificar
secrets = api("GET", f"/repos/{OWNER}/{REPO}/actions/secrets")
for s in secrets.get("secrets", []):
    print(f"- {s['name']} (actualizado {s['updated_at']})")
