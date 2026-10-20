#!/usr/bin/env python3
"""Backup the binary files in the private Engefex Supabase Storage bucket."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
API_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "engefex-files"
DEST = Path(sys.argv[1]).resolve()
DEST.mkdir(parents=True, exist_ok=True)
HEADERS = {"apikey": API_KEY, "Authorization": "Bearer " + API_KEY}
ITEMS = []
SEEN = set()
VISITED = set()

def http(path, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = dict(HEADERS)
    if data is not None:
        headers["Content-Type"] = "application/json"
    for attempt in range(3):
        try:
            req = Request(BASE_URL + path, data=data, headers=headers,
                          method="POST" if data is not None else "GET")
            return urlopen(req, timeout=90)
        except (HTTPError, URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def safe_path(name):
    if not name or name.startswith("/") or any(p in ("", ".", "..") for p in name.split("/")):
        raise ValueError("Unsafe Storage filename")
    target = (DEST / name).resolve()
    if not target.is_relative_to(DEST):
        raise ValueError("Path outside backup directory")
    return target

def download(name, meta):
    if name in SEEN:
        return
    SEEN.add(name)
    target = safe_path(name)
    target.parent.mkdir(parents=True, exist_ok=True)
    url = "/storage/v1/object/authenticated/" + quote(BUCKET, safe="") + "/" + quote(name, safe="/")
    digest = hashlib.sha256()
    count = 0
    with http(url) as response, target.open("wb") as out:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            out.write(chunk)
            count += len(chunk)
    expected = meta.get("size")
    if expected is not None and count != int(expected):
        raise RuntimeError("Storage download size mismatch")
    ITEMS.append({"path": name, "size": count, "sha256": digest.hexdigest()})

def browse(prefix=""):
    if prefix in VISITED:
        raise RuntimeError("Repeated Storage directory")
    VISITED.add(prefix)
    offset, limit = 0, 100
    while True:
        path = "/storage/v1/object/list/" + quote(BUCKET, safe="")
        body = {"prefix": prefix, "limit": limit, "offset": offset,
                "sortBy": {"column": "name", "order": "asc"}}
        with http(path, payload=body) as response:
            rows = json.load(response)
        if not isinstance(rows, list):
            raise RuntimeError("Unexpected response listing Storage objects")
        for item in rows:
            name = item.get("name")
            if not isinstance(name, str) or name in ("", ".", ".."):
                raise RuntimeError("Invalid Storage object name")
            full = prefix + name
            if item.get("id") is None and item.get("metadata") is None:
                browse(full + "/")
            else:
                download(full, item.get("metadata") or {})
        offset += len(rows)
        if len(rows) < limit:
            break

browse()
if not ITEMS:
    raise RuntimeError("No Storage objects; refusing incomplete backup")
manifest = {"bucket": BUCKET, "file_count": len(ITEMS),
            "files": sorted(ITEMS, key=lambda x: x["path"])}
(DEST.parent / "storage-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("Storage backup: " + str(len(ITEMS)) + " files, SHA-256 per file.")
