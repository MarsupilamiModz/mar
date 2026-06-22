#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ "${NODE_ENV:-production}" == "production" && "${NEXT_PUBLIC_APP_URL:-}" == *"localhost"* ]]; then
  export NEXT_PUBLIC_APP_URL="https://www.xumari-modz.com"
fi

exec ./node_modules/.bin/next start -H 127.0.0.1 -p 3000
