#!/usr/bin/env bash
# Stop the BugPilot processes started by ./start.sh
set -euo pipefail

for port in "${PORT:-4000}" "${WEB_PORT:-5173}" "${AI_PORT:-8000}"; do
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping port $port"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
done

sleep 1

for port in "${PORT:-4000}" "${WEB_PORT:-5173}" "${AI_PORT:-8000}"; do
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "BugPilot app processes stopped. MongoDB was left running."
