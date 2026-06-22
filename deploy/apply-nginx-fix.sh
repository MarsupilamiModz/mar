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

cp "$TARGET" "${TARGET}.bak.$(date +%Y%m%d%H%M%S)"

# Broken upstreams seen in production logs
sed -i \
  -e 's|proxy_pass http://localhost;|proxy_pass http://127.0.0.1:3000;|g' \
  -e 's|proxy_pass http://localhost/;|proxy_pass http://127.0.0.1:3000/;|g' \
  -e 's|proxy_pass http://\[::1\]:3000;|proxy_pass http://127.0.0.1:3000;|g' \
  "$TARGET"

if ! grep -q 'proxy_buffer_size 128k' "$TARGET"; then
  SNIPPET_FILE="$REPO_DIR/deploy/nginx-proxy-snippet.conf"
  INSERT=$(cat "$SNIPPET_FILE" | sed 's/^/        /')

  python3 - "$TARGET" "$INSERT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
insert = sys.argv[2]
text = path.read_text()

if "proxy_buffer_size 128k" in text:
    sys.exit(0)

needle = "location / {"
idx = text.find(needle)
if idx == -1:
    print("ERROR: Could not find 'location / {' in nginx config.")
    print("Add deploy/nginx-proxy-snippet.conf manually inside location / { }")
    sys.exit(1)

# Insert after opening brace of location /
brace = text.find("{", idx)
if brace == -1:
    sys.exit(1)

updated = text[: brace + 1] + "\n" + insert + text[brace + 1 :]
path.write_text(updated)
print("Inserted proxy buffer settings into location / block")
PY
fi

nginx -t
systemctl reload nginx

echo ""
echo "==> nginx reloaded. Test:"
echo "  curl -s -o /dev/null -w 'direct: %{http_code}\n' http://127.0.0.1:3000/de/premium"
echo "  curl -s -o /dev/null -w 'nginx:  %{http_code}\n' -H 'Host: $SITE_NAME' http://127.0.0.1/de/premium"
