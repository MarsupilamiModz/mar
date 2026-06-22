#!/usr/bin/env bash
# Optional manual start — Next.js also reads .env without this script.
set -eo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env || true
  set +a
fi

if [[ "${NODE_ENV:-production}" == "production" && "${NEXT_PUBLIC_APP_URL:-}" == *"localhost"* ]]; then
  export NEXT_PUBLIC_APP_URL="https://www.xumari-modz.com"
fi

exec node ./node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
