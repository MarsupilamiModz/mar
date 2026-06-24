#!/usr/bin/env bash
# Repairs common nginx breakage from repeated apply-nginx-fix runs:
# - large_client_header_buffers inside location / (invalid)
# - duplicate proxy_* lines inside location /
# Run: sudo bash deploy/fix-nginx-headers.sh [config-path]
set -euo pipefail

TARGET="${1:-/etc/nginx/sites-enabled/default}"

if [[ ! -f "$TARGET" ]]; then
  echo "Config not found: $TARGET"
  exit 1
fi

cp "$TARGET" "${BACKUP_DIR}/$(basename "$TARGET").bak.fix-$(date +%Y%m%d%H%M%S)"

python3 - "$TARGET" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines()

# 1) Remove large_client_header_buffers from anywhere (re-add at server level later)
without_lchb = [
    line
    for line in lines
    if not (
        "large_client_header_buffers" in line and not line.strip().startswith("#")
    )
]

# 2) Deduplicate identical proxy/large_client lines inside each location / { } block
PROXY_PREFIXES = ("proxy_", "large_client_header_buffers")

def dedupe_location_blocks(src_lines: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(src_lines):
        line = src_lines[i]
        stripped = line.strip()
        if stripped.startswith("location /") and "{" in stripped:
            out.append(line)
            i += 1
            depth = 1
            seen: set[str] = set()
            while i < len(src_lines) and depth > 0:
                cur = src_lines[i]
                s = cur.strip()
                depth += s.count("{") - s.count("}")
                if depth > 0 and s and not s.startswith("#"):
                    if s.startswith(PROXY_PREFIXES) and s in seen:
                        i += 1
                        continue
                    if s.startswith(PROXY_PREFIXES):
                        seen.add(s)
                out.append(cur)
                i += 1
            continue
        out.append(line)
        i += 1
    return out

cleaned = dedupe_location_blocks(without_lchb)
text = "\n".join(cleaned)

# 3) Ensure large_client_header_buffers at server level (HTTPS block preferred)
if "large_client_header_buffers 8 32k" not in text:
    insert_at = None
    for marker in ("listen 443", "listen [::]:443 ssl", "listen [::]:443"):
        idx = text.find(marker)
        if idx == -1:
            continue
        server_idx = text.rfind("server {", 0, idx)
        if server_idx != -1:
            insert_at = text.find("{", server_idx) + 1
            break
    if insert_at is None:
        server_idx = text.find("server {")
        if server_idx != -1:
            insert_at = text.find("{", server_idx) + 1
    if insert_at is not None:
        text = text[:insert_at] + "\n    large_client_header_buffers 8 32k;" + text[insert_at:]

path.write_text(text + "\n")
print(f"Patched {path}")
PY

if ! nginx -t; then
  echo "nginx -t failed — check ${TARGET}"
  exit 1
fi

systemctl reload nginx
echo "OK — nginx reloaded"
