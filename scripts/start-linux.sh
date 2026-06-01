#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
fi

if [ ! -f "$ROOT_DIR/frontend/.env.local" ]; then
  cp "$ROOT_DIR/frontend/.env.local.example" "$ROOT_DIR/frontend/.env.local"
fi

if [ ! -d "$ROOT_DIR/backend/.venv" ]; then
  python3 -m venv "$ROOT_DIR/backend/.venv"
fi

source "$ROOT_DIR/backend/.venv/bin/activate"
pip install -r "$ROOT_DIR/backend/requirements.txt"

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  (cd "$ROOT_DIR/frontend" && npm install)
fi

pkill -f "uvicorn app.main:app.*8008" 2>/dev/null || true
pkill -f "next dev .*--port 5174" 2>/dev/null || true
pkill -f "next start .*--port 5174" 2>/dev/null || true

(cd "$ROOT_DIR/backend" && "$ROOT_DIR/backend/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8008 > "$LOG_DIR/backend.log" 2>&1 &)
(cd "$ROOT_DIR/frontend" && npm run dev:ipv4 > "$LOG_DIR/frontend.log" 2>&1 &)

echo "BioSeqMind-AI started"
echo "Frontend: http://localhost:5174"
echo "Host LAN: http://<linux-ip>:5174"
echo "Backend:  http://127.0.0.1:8008/api/health"
echo "Logs:     $LOG_DIR"
