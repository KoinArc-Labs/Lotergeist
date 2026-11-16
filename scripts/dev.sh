#!/usr/bin/env bash
# Starts Chimera Rx: API on 4000 and web app on 5173. Ctrl-C stops both.
set -e
cd "$(dirname "$0")/.."
pnpm --filter @chimera-rx/api run dev &
API=$!
pnpm --filter @chimera-rx/web run dev &
WEB=$!
trap 'kill $API $WEB 2>/dev/null' EXIT INT TERM
wait
