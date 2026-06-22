#!/usr/bin/env bash
# Repairs "large_client_header_buffers directive is not allowed here" (wrong block).
# Run: sudo bash deploy/fix-nginx-headers.sh
set -euo pipefail

TARGET="${1:-/etc/nginx/sites-enabled/default}"

if [[ ! -f "$TARGET" ]]; then
  echo "Config not found: $TARGET"
  exit 1
fi

cp "$TARGET" "${TARGET}.bak.fix-$(date +%Y%m%d%H%M%S)"

python3 - "$TARGET" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines()

# Drop every active large_client_header_buffers line (often wrongly inside location /)
cleaned = [
    line
    for line in lines
    if not (
        "large_client_header_buffers" in line and not line.strip().startswith("#")
    )
]

text = "\n".join(cleaned)

if "large_client_header_buffers 8 32k" not in text:
    # Prefer HTTPS server block (443), else first server block
    markers = ["listen 443", "listen [::]:443", "server {"]
    insert_at = None
    for marker in markers:
        idx = text.find(marker)
        if idx == -1:
            continue
        server_idx = text.rfind("server {", 0, idx)
        if server_idx == -1:
            server_idx = text.find("server {")
        if server_idx != -1:
            brace = text.find("{", server_idx)
            insert_at = brace + 1
            break
    if insert_at is None:
        brace = text.find("{", text.find("server {"))
        insert_at = brace + 1 if brace != -1 else len(text)
    text = text[:insert_at] + "\n    large_client_header_buffers 8 32k;" + text[insert_at:]

path.write_text(text + "\n")
print(f"Patched {path}")
PY

nginx -t
systemctl reload nginx
echo "OK — nginx reloaded"
