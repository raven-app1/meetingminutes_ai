#!/usr/bin/env bash
set -e

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "   Meeting Minutes AI — Launching Server"
echo "============================================================"

# Ensure sample audio exists
python3 -c "from backend.sample_generator import ensure_sample_audio_exists; ensure_sample_audio_exists()" || true

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo "Starting server at http://${HOST}:${PORT}"
echo "Press Ctrl+C to stop."
echo "============================================================"

exec python3 -m uvicorn backend.main:app --host "$HOST" --port "$PORT"
