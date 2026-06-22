#!/usr/bin/env bash
set -euo pipefail

# Fixes nginx 502 "upstream sent too big header" + broken localhost upstream.
# Run on server: bash deploy/apply-nginx-fix.sh

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_NAME="${NGINX_SITE:-xumari-modz.com}"
SITES_AVAILABLE="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"

echo "==> Searching nginx config for $SITE_NAME ..."

TARGET=""
for f in \
  "$SITES_ENABLED/$SITE_NAME" \
  "$SITES_AVAILABLE/$SITE_NAME" \
  "$SITES_ENABLED/xumari-modz.com" \
  "$SITES_AVAILABLE/xumari-modz.com" \
  "$SITES_ENABLED/default"; do
  if [[ -f "$f" ]]; then
    TARGET="$f"
    break
  fi
done

if [[ -z "$TARGET" ]]; then
  echo "Installing new site config ..."
  cp "$REPO_DIR/deploy/nginx-xumari-modz.conf" "$SITES_AVAILABLE/$SITE_NAME"
  ln -sf "$SITES_AVAILABLE/$SITE_NAME" "$SITES_ENABLED/$SITE_NAME"
  nginx -t && systemctl reload nginx
  echo "Installed $SITES_AVAILABLE/$SITE_NAME"
  exit 0
fi

echo "==> Patching $TARGET"

BACKUP="${TARGET}.bak.$(date +%Y%m%d%H%M%S)"
cp "$TARGET" "$BACKUP"
echo "Backup: $BACKUP"

restore_backup() {
  echo "==> Restoring backup after failed nginx -t"
  cp "$BACKUP" "$TARGET"
}

trap 'if [[ $? -ne 0 ]]; then restore_backup 2>/dev/null || true; fi' EXIT

# Broken upstreams seen in production logs
sed -i \
  -e 's|proxy_pass http://localhost;|proxy_pass http://127.0.0.1:3000;|g' \
  -e 's|proxy_pass http://localhost/;|proxy_pass http://127.0.0.1:3000/;|g' \
  -e 's|proxy_pass http://\[::1\]:3000;|proxy_pass http://127.0.0.1:3000;|g' \
  "$TARGET"

python3 - "$TARGET" "$REPO_DIR/deploy/nginx-proxy-snippet.conf" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
snippet_path = Path(sys.argv[2])
text = path.read_text()

# Remove invalid directive if a prior run inserted it inside location /
text = "\n".join(
    line for line in text.splitlines()
    if "large_client_header_buffers" not in line or line.strip().startswith("#")
)
# If we removed all such lines, re-add at server level below
if "large_client_header_buffers 8 32k" not in text:
    marker = "client_max_body_size"
    idx = text.find(marker)
    if idx != -1:
        line_end = text.find("\n", idx)
        insert_at = line_end + 1 if line_end != -1 else len(text)
        text = (
            text[:insert_at]
            + "    large_client_header_buffers 8 32k;\n"
            + text[insert_at:]
        )
    else:
        # First server { block
        needle = "server {"
        idx = text.find(needle)
        if idx != -1:
            brace = text.find("{", idx)
            text = text[: brace + 1] + "\n    large_client_header_buffers 8 32k;\n" + text[brace + 1 :]

if "proxy_buffer_size 128k" not in text:
    insert = snippet_path.read_text()
    insert = "\n".join("        " + line if line.strip() else line for line in insert.splitlines())
    needle = "location / {"
    idx = text.find(needle)
    if idx == -1:
        print("ERROR: Could not find 'location / {' in nginx config.")
        sys.exit(1)
    brace = text.find("{", idx)
    text = text[: brace + 1] + "\n" + insert + text[brace + 1 :]
    print("Inserted proxy buffer settings into location / block")
else:
    print("Proxy buffer settings already present")

path.write_text(text)
PY

if ! nginx -t; then
  echo "ERROR: nginx config invalid — backup restored"
  restore_backup
  exit 1
fi

systemctl reload nginx
trap - EXIT

echo ""
echo "==> nginx reloaded. Test:"
echo "  curl -s -o /dev/null -w 'direct: %{http_code}\n' http://127.0.0.1:3000/de/premium"
echo "  curl -s -o /dev/null -w 'nginx:  %{http_code}\n' https://$SITE_NAME/de/premium"
