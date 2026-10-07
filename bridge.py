#!/usr/bin/env python3
"""
Local Antigravity CLI Bridge for Burmese Meeting Minutes AI
Connects the client-side web application to your local authenticated `agy` CLI.
Enables using your active Antigravity subscription directly from the web app with zero API key!
"""

import http.server
import socketserver
import json
import subprocess
import shutil
import os
import sys

PORT = 3001

def find_agy_binary():
    """Locate the agy or antigravity binary."""
    candidate = shutil.which('agy')
    if candidate:
        return candidate
    local_path = os.path.expanduser('~/.local/bin/agy')
    if os.path.isfile(local_path) and os.access(local_path, os.X_OK):
        return local_path
    return None

class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/health':
            agy = find_agy_binary()
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            resp = {
                "available": bool(agy),
                "authenticated": bool(agy),
                "agent": agy or "none"
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/process':
            agy = find_agy_binary()
            if not agy:
                self.send_response(500)
                self._send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Antigravity CLI (agy) not found on this machine."}).encode('utf-8'))
                return

            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            try:
                data = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid JSON payload: {e}"}).encode('utf-8'))
                return

            prompt = data.get('prompt', '')
            if not prompt:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Missing prompt in request"}).encode('utf-8'))
                return

            # Execute agy CLI with -p prompt non-interactively
            try:
                cmd = [agy, "--dangerously-skip-permissions", "--effort", "low"]
                model = data.get('model')
                if model:
                    cmd.extend(["--model", str(model)])
                cmd.extend(["-p", prompt])

                proc = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=300
                )

                output_text = proc.stdout.strip()
                if proc.returncode != 0 or "jetski: no output produced" in output_text:
                    err_msg = proc.stderr.strip() or output_text or "CLI execution failed"
                    self.send_response(500)
                    self._send_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": f"CLI error: {err_msg}"}).encode('utf-8'))
                    return

                self.send_response(200)
                self._send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"result": output_text}).encode('utf-8'))

            except subprocess.TimeoutExpired:
                self.send_response(504)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Antigravity CLI processing timed out (5 minutes limit)"}).encode('utf-8'))
            except Exception as err:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(err)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_bridge(port=PORT):
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), BridgeHandler) as httpd:
        print("=" * 60)
        print(" 🚀  Antigravity CLI Local Bridge Running")
        print("=" * 60)
        print(f" Port: {port}")
        print(" Binary:", find_agy_binary() or "Not found")
        print(" Allows Web App to use Antigravity subscription directly with zero API keys.")
        print(" Press Ctrl+C to stop.")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down bridge...")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_bridge(port)
