#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up -d mongo ollama

cleanup() {
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd server && OLLAMA_BASE_URL=http://localhost:11434 npm run dev) &
(cd client && npm run dev) &
wait
