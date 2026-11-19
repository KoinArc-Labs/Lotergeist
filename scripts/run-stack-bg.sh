#!/usr/bin/env bash
# Starts the demo stack detached and waits until both ports answer. Logs go to the file named by $1.
set -e
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/chimera-stack.log}"
nohup bash scripts/dev.sh > "$LOG" 2>&1 &
for i in $(seq 1 60); do
  if curl -fs localhost:4000/api/health >/dev/null && curl -fs localhost:5173 >/dev/null; then echo "stack up"; exit 0; fi
  sleep 1
done
echo "stack did not come up; see $LOG"; exit 1
