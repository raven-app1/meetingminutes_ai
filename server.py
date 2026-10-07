#!/usr/bin/env python3
"""
Simple HTTP Server for Burmese Meeting Minutes AI Web App
Zero external dependencies. Runs out of the box with standard library.
"""

import http.server
import socketserver
import os
import sys

PORT = 3000

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS and no-cache headers for smooth local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        mtype = super().guess_type(path)
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        return mtype

def run_server(port=PORT):
    # Ensure working directory is the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Allow reuse of address
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), CustomHTTPHandler) as httpd:
        print("=" * 60)
        print(" 🎙️  Burmese Meeting Minutes AI Web App Server Running")
        print("=" * 60)
        print(f" URL: http://localhost:{port}")
        print(" Pure Client-Side application (No backend required)")
        print(" Press Ctrl+C to stop.")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
