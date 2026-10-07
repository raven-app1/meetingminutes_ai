#!/usr/bin/env python3
"""
Local Antigravity CLI Bridge for Burmese Meeting Minutes AI
===========================================================

Runs your locally signed-in `agy` (Antigravity CLI) behind a tiny localhost API,
so the web app can generate meeting minutes with your **Antigravity
subscription — no Gemini API key required**.

One-time setup
--------------
    # 1. Install the Antigravity CLI (macOS / Linux / Googlebook)
    curl -fsSL https://antigravity.google/cli/install.sh | bash

    # 2. Sign in once, interactively. Headless runs reuse these cached
    #    credentials, so this step is required before the bridge can work.
    agy

    # 3. Diagnose, then start the bridge
    python3 bridge.py --check      # shows binary + version + sign-in hint
    python3 bridge.py              # http://localhost:3001

Then open the web app on http://localhost:3000, choose
"⚡ Antigravity / Zero Key" and press "⚡ Local Bridge".

Notes
-----
* Headless `agy -p` is used with `--output-format json`, so the bridge reads the
  agent's answer from the machine-readable envelope instead of scraping text.
* Audio selected in the browser is written to a private temp folder which is
  also the CLI working directory, and the prompt points the agent at that file.
  Some CLI builds cannot decode audio themselves — if a run fails on the audio
  file, use the in-app "Gemini Web" workflow, which accepts audio uploads
  directly with your subscription.
* Environment overrides:
    AGY_BIN            path to the agy binary (default: auto-detect)
    BRIDGE_PORT        port to listen on (default: 3001)
    BRIDGE_TIMEOUT     hard subprocess timeout in seconds (default: 600)
    BRIDGE_CLI_TIMEOUT value passed to `agy --timeout` (default: unset)
    BRIDGE_EFFORT      `agy --effort` value: low | medium | high (default: unset)
    BRIDGE_MODEL       `agy --model` label (default: unset)
    BRIDGE_PERMISSIVE  set to 0 to drop --dangerously-skip-permissions
"""

import base64
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile

PORT = int(os.environ.get('BRIDGE_PORT', '3001'))
DEFAULT_TIMEOUT = int(os.environ.get('BRIDGE_TIMEOUT', '600'))

AUDIO_EXTENSIONS = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/m4a': '.m4a',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/x-wav': '.wav',
    'audio/aac': '.aac',
    'audio/ogg': '.ogg',
    'audio/opus': '.opus',
    'audio/webm': '.webm',
    'audio/flac': '.flac',
    'audio/x-flac': '.flac',
}


def find_agy_binary():
    """Locate the Antigravity CLI binary (agy)."""
    explicit = os.environ.get('AGY_BIN') or os.environ.get('ANTIGRAVITY_BIN')
    if explicit:
        if os.path.isfile(explicit) and os.access(explicit, os.X_OK):
            return explicit
        found = shutil.which(explicit)
        if found:
            return found
        return None

    for name in ('agy', 'antigravity'):
        found = shutil.which(name)
        if found:
            return found

    home = os.path.expanduser('~')
    candidates = [
        os.path.join(home, '.local', 'bin', 'agy'),
        os.path.join(home, '.local', 'bin', 'antigravity'),
    ]

    local_app_data = os.environ.get('LOCALAPPDATA')
    if local_app_data:
        candidates.append(os.path.join(local_app_data, 'agy', 'bin', 'agy.exe'))
        candidates.append(os.path.join(local_app_data, 'agy', 'bin', 'agy.cmd'))

    for candidate in candidates:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def agy_version(binary, timeout=20):
    """Best-effort `agy --version` lookup; returns None when unavailable."""
    if not binary:
        return None
    try:
        proc = subprocess.run(
            [binary, '--version'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
        )
        output = (proc.stdout or '').strip()
        return output.splitlines()[0].strip() if output else None
    except Exception:
        return None


def build_command(binary, prompt, model=None, effort=None, cli_timeout=None):
    """Assemble the headless `agy` invocation."""
    cmd = [binary, '--output-format', 'json']
    if os.environ.get('BRIDGE_PERMISSIVE', '1') != '0':
        cmd.append('--dangerously-skip-permissions')
    model = model or os.environ.get('BRIDGE_MODEL')
    effort = effort or os.environ.get('BRIDGE_EFFORT')
    cli_timeout = cli_timeout or os.environ.get('BRIDGE_CLI_TIMEOUT')
    if model:
        cmd.extend(['--model', str(model)])
    if effort:
        cmd.extend(['--effort', str(effort)])
    if cli_timeout:
        cmd.extend(['--timeout', str(cli_timeout)])
    cmd.extend(['-p', prompt])
    return cmd


def safe_audio_name(file_name, mime_type):
    """Derive a safe file name for the temp workspace."""
    base = os.path.basename(file_name or '')
    base = re.sub(r'[^A-Za-z0-9._-]+', '_', base).lstrip('._')
    if not base:
        base = 'meeting-recording'
    if not os.path.splitext(base)[1]:
        base += AUDIO_EXTENSIONS.get((mime_type or '').lower(), '.mp3')
    return base


def decode_audio(audio):
    """Decode a base64 audio payload from the browser into raw bytes."""
    if not isinstance(audio, dict):
        return None, None, None
    raw_b64 = audio.get('base64') or audio.get('data') or ''
    if not raw_b64:
        return None, None, None
    if raw_b64.startswith('data:'):
        raw_b64 = raw_b64.split(',', 1)[-1]
    try:
        data = base64.b64decode(raw_b64, validate=False)
    except Exception:
        return None, None, None
    mime = audio.get('mimeType') or audio.get('mime') or 'audio/mp3'
    return data, safe_audio_name(audio.get('fileName') or audio.get('name'), mime), mime


def describe_audio_attachment(file_name):
    return (
        f"ATTACHED MEETING RECORDING: ./{file_name}\n"
        "This audio file is in the current working directory. Read it and use its\n"
        "spoken content as the source material for the task below.\n"
    )


def parse_cli_output(stdout):
    """
    Extract the answer from `agy --output-format json`.

    Returns (text, error). Falls back to raw stdout for CLI builds that print
    plain text, so the bridge keeps working across versions.
    """
    output = (stdout or '').strip()
    if not output:
        return None, 'Antigravity CLI produced no output.'

    payload = None
    try:
        payload = json.loads(output)
    except Exception:
        for line in reversed(output.splitlines()):
            line = line.strip()
            if line.startswith('{') and line.endswith('}'):
                try:
                    payload = json.loads(line)
                    break
                except Exception:
                    continue

    if not isinstance(payload, dict):
        return output, None

    if payload.get('response'):
        return str(payload['response']).strip(), None

    status = str(payload.get('status') or '').upper()
    err = payload.get('error') or payload.get('message')
    if err:
        return None, f"{err}" + (f" (status: {status})" if status else '')
    if status and status != 'SUCCESS':
        return None, f"Antigravity CLI reported status {status} without a response."
    return None, 'Antigravity CLI returned an empty response.'


def run_agy(prompt, audio=None, model=None, effort=None, timeout=None):
    """
    Execute one headless Antigravity CLI run.

    Returns {'ok': bool, 'result': str|None, 'error': str|None,
             'cli': str|None, 'duration_seconds': float|None}
    """
    binary = find_agy_binary()
    if not binary:
        return {
            'ok': False,
            'result': None,
            'error': (
                'Antigravity CLI (agy) was not found on this machine. Install it with '
                '`curl -fsSL https://antigravity.google/cli/install.sh | bash`, then run `agy` once '
                'to sign in with your Antigravity subscription.'
            ),
            'cli': None,
            'duration_seconds': None,
        }

    workspace = None
    cleanup = True
    full_prompt = prompt
    try:
        data, file_name, _mime = decode_audio(audio)
        if data:
            workspace = tempfile.mkdtemp(prefix='meeting-minutes-')
            audio_path = os.path.join(workspace, file_name)
            with open(audio_path, 'wb') as handle:
                handle.write(data)
            full_prompt = f"{describe_audio_attachment(file_name)}\n{prompt}"

        cmd = build_command(binary, full_prompt, model=model, effort=effort)
        proc = subprocess.run(
            cmd,
            cwd=workspace or os.getcwd(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=int(timeout or DEFAULT_TIMEOUT),
        )

        text, parse_error = parse_cli_output(proc.stdout)
        if proc.returncode != 0 or parse_error:
            detail = (proc.stderr or '').strip()
            if detail:
                detail = detail.splitlines()[-1].strip()
            message = parse_error or 'Antigravity CLI run failed.'
            if detail and detail not in message:
                message = f"{message} {detail}"
            if 'auth' in message.lower() and 'required' in message.lower():
                message += ' Run `agy` once in a terminal to sign in with your subscription.'
            return {
                'ok': False,
                'result': None,
                'error': message,
                'cli': binary,
                'duration_seconds': None,
            }

        return {
            'ok': True,
            'result': text,
            'error': None,
            'cli': binary,
            'duration_seconds': None,
        }

    except subprocess.TimeoutExpired:
        return {
            'ok': False,
            'result': None,
            'error': f'Antigravity CLI processing timed out after {int(timeout or DEFAULT_TIMEOUT)} seconds.',
            'cli': binary,
            'duration_seconds': None,
        }
    except Exception as err:  # noqa: BLE001 - surfaced to the browser as-is
        return {'ok': False, 'result': None, 'error': str(err), 'cli': binary, 'duration_seconds': None}
    finally:
        if workspace and cleanup:
            shutil.rmtree(workspace, ignore_errors=True)


class BridgeHandler(http.server.BaseHTTPRequestHandler):
    server_version = 'AntigravityBridge/2.0'

    def log_message(self, fmt, *args):  # quieter, single-line logging
        sys.stderr.write("[bridge] %s\n" % (fmt % args))

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _respond(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        path, _, query = self.path.partition('?')

        if path == '/api/health':
            binary = find_agy_binary()
            payload = {
                'available': bool(binary),
                'authenticated': bool(binary),
                'agent': binary or 'none',
                'cli': binary or 'none',
                'version': agy_version(binary) if binary else None,
                'bridgeVersion': '2.0',
                'audioUploadSupported': True,
                'hints': [] if binary else [
                    'Install the Antigravity CLI: curl -fsSL https://antigravity.google/cli/install.sh | bash',
                    'Sign in once by running `agy` in a terminal (browser sign-in, no API key needed).',
                    'Then start the bridge: python3 bridge.py',
                ],
            }

            # Opt-in live verification: costs one tiny agent turn.
            if 'verify=1' in query:
                probe = run_agy('Reply with the single word: READY', timeout=min(120, DEFAULT_TIMEOUT))
                payload['authenticated'] = bool(probe['ok'])
                payload['verifyDetail'] = probe['result'] if probe['ok'] else probe['error']

            self._respond(200, payload)
            return

        self._respond(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/api/process':
            self._respond(404, {'error': 'Not found'})
            return

        try:
            content_len = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_len).decode('utf-8') or '{}')
        except Exception as err:  # noqa: BLE001
            self._respond(400, {'error': f'Invalid JSON payload: {err}'})
            return

        prompt = (data.get('prompt') or '').strip()
        if not prompt:
            self._respond(400, {'error': 'Missing prompt in request'})
            return

        outcome = run_agy(
            prompt,
            audio=data.get('audio'),
            model=data.get('model'),
            effort=data.get('effort'),
            timeout=data.get('timeoutSeconds'),
        )

        if not outcome['ok']:
            self._respond(502, {'error': outcome['error'] or 'Antigravity CLI run failed.'})
            return

        self._respond(200, {'result': outcome['result'], 'cli': outcome['cli']})


def run_bridge(port=PORT):
    socketserver.TCPServer.allow_reuse_address = True
    binary = find_agy_binary()
    with socketserver.TCPServer(('127.0.0.1', port), BridgeHandler) as httpd:
        print('=' * 66)
        print(' 🚀  Antigravity CLI Local Bridge (no Gemini API key needed)')
        print('=' * 66)
        print(f' Port      : {port}   (http://localhost:{port})')
        print(f' CLI binary: {binary or "NOT FOUND"}')
        if binary:
            print(f' CLI version: {agy_version(binary) or "unknown"}')
        else:
            print('   Install : curl -fsSL https://antigravity.google/cli/install.sh | bash')
            print('   Sign in : run `agy` once in a terminal (browser sign-in)')
        print(' Press Ctrl+C to stop.')
        print('=' * 66)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down bridge...')


def check_environment():
    """`python3 bridge.py --check` — diagnose the local Antigravity setup."""
    binary = find_agy_binary()
    print('Antigravity CLI bridge diagnostics')
    print('-' * 66)
    if not binary:
        print('✖ `agy` binary: NOT FOUND on PATH, ~/.local/bin or %LOCALAPPDATA%\\agy\\bin')
        print('  Install it: curl -fsSL https://antigravity.google/cli/install.sh | bash')
        print('  Then sign in: agy')
        return 1

    print(f'✔ `agy` binary: {binary}')
    print(f'  version     : {agy_version(binary) or "unknown"}')

    probe = run_agy('Reply with the single word: READY', timeout=min(120, DEFAULT_TIMEOUT))
    if probe['ok']:
        print(f'✔ headless run + sign-in: OK (agent replied: {probe["result"]!r})')
        print('  Start the bridge with: python3 bridge.py')
        return 0

    print('✖ headless run failed — the CLI is installed but not signed in (or failed):')
    print(f'  {probe["error"]}')
    print('  Run `agy` once in a terminal, sign in with your Antigravity subscription, then retry.')
    return 1


if __name__ == '__main__':
    if '--check' in sys.argv or '--diagnose' in sys.argv:
        sys.exit(check_environment())
    run_bridge(int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else PORT)
