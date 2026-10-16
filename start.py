#!/usr/bin/env python3
"""Convenient Python entry point to launch the Meeting Minutes AI web application."""

import os
import sys
import uvicorn

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.sample_generator import ensure_sample_audio_exists


def main():
    print("=" * 60)
    print("   Meeting Minutes AI — Launching Server")
    print("=" * 60)

    # Pre-generate or verify sample audio
    try:
        sample_path = ensure_sample_audio_exists()
        print(f"✓ Sample audio ready: {sample_path}")
    except Exception as e:
        print(f"! Notice: Could not pre-generate sample audio: {e}")

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))

    print(f"Starting server on http://{host}:{port}")
    print("Open http://localhost:8000 in your browser.")
    print("=" * 60)

    uvicorn.run("backend.main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
