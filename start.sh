#!/usr/bin/env bash
# Start BugPilot with one command: API, UI, Groq AI, and MongoDB.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

API_PORT="${PORT:-4000}"
WEB_PORT="${WEB_PORT:-5173}"
AI_PORT="${AI_PORT:-8000}"
MONGO_PORT="${MONGO_PORT:-27017}"

log() { printf '\n==> %s\n' "$*"; }
ok() { printf '    %s\n' "$*"; }

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    ok "Stopping whatever is on port $port"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

wait_port() {
  local port="$1"
  local name="$2"
  local tries="${3:-40}"
  local i=0
  while (( i < tries )); do
    if port_in_use "$port"; then
      ok "$name is ready on :$port"
      return 0
    fi
    i=$((i + 1))
    sleep 0.4
  done
  printf 'error: %s did not start on port %s\n' "$name" "$port" >&2
  return 1
}

if [[ ! -f .env ]]; then
  log "Creating .env from .env.example"
  cp .env.example .env
  ok "Add your Groq key to .env as AI_API_KEY if you want AI-written tests"
fi

if [[ ! -d node_modules ]]; then
  log "Installing npm packages (first run)"
  npm install
fi

if ! python3 -c "import uvicorn, fastapi, httpx, pydantic_settings" >/dev/null 2>&1; then
  log "Installing Python AI packages"
  python3 -m pip install -r ai-service/requirements.txt
fi

if ! port_in_use "$MONGO_PORT"; then
  log "Starting MongoDB"
  if command -v docker >/dev/null 2>&1; then
    docker compose up -d mongodb
  else
    printf 'error: MongoDB is not running on port %s and Docker is not available.\n' "$MONGO_PORT" >&2
    printf 'Start MongoDB, then run this script again.\n' >&2
    exit 1
  fi
  wait_port "$MONGO_PORT" "MongoDB" 50
else
  log "MongoDB already running on :$MONGO_PORT"
fi

log "Freeing app ports so this script owns them"
kill_port "$API_PORT"
kill_port "$WEB_PORT"
kill_port "$AI_PORT"

cleanup() {
  printf '\n==> Stopping BugPilot\n'
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" 2>/dev/null || true; fi
  if [[ -n "${AI_PID:-}" ]]; then kill "$AI_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

log "Starting API, UI, and Groq AI"
(
  cd "$ROOT/backend"
  exec npx tsx src/server.ts
) > "$ROOT/.bugpilot-api.log" 2>&1 &
API_PID=$!

(
  cd "$ROOT"
  exec npm run dev -w frontend
) > "$ROOT/.bugpilot-web.log" 2>&1 &
WEB_PID=$!

(
  cd "$ROOT/ai-service"
  exec python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$AI_PORT"
) > "$ROOT/.bugpilot-ai.log" 2>&1 &
AI_PID=$!

wait_port "$API_PORT" "API"
wait_port "$WEB_PORT" "UI"
wait_port "$AI_PORT" "AI"

cat <<EOF

BugPilot is running. Leave this terminal open.

  UI   http://localhost:${WEB_PORT}
  API  http://localhost:${API_PORT}
  AI   http://127.0.0.1:${AI_PORT}  (Groq)

Logs: .bugpilot-api.log  .bugpilot-web.log  .bugpilot-ai.log
Stop: Ctrl+C   or   ./stop.sh

EOF

wait
