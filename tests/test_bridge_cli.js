const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const BRIDGE = path.join(PROJECT_ROOT, 'bridge.py');

function pythonBin() {
  for (const candidate of ['python3', 'python']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const STUB_CLI = `#!/usr/bin/env python3
import json, os, sys

argv = sys.argv[1:]
if '--version' in argv:
    print('agy 9.9.9-stub')
    sys.exit(0)

prompt = ''
if '-p' in argv:
    prompt = argv[argv.index('-p') + 1]

record = {'cwd': os.getcwd(), 'prompt': prompt, 'argv': argv, 'files': {}}
for name in sorted(os.listdir('.')):
    if os.path.isfile(name):
        with open(name, 'rb') as handle:
            record['files'][name] = len(handle.read())

out_path = os.environ.get('STUB_RECORD')
if out_path:
    with open(out_path, 'w') as handle:
        json.dump(record, handle)

mode = os.environ.get('STUB_MODE', 'ok')
if mode == 'auth':
    print(json.dumps({'status': 'AUTH_REQUIRED', 'error': 'Authentication required'}))
    sys.stderr.write('authentication required\\n')
    sys.exit(1)
if mode == 'plain':
    print('PLAIN TEXT MINUTES')
    sys.exit(0)

print(json.dumps({'status': 'SUCCESS', 'response': 'STUB MINUTES', 'usage': {'total_tokens': 3}}))
`;

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return res.json();
    } catch (e) {
      // bridge not listening yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('bridge did not start listening in time');
}

async function startBridge({ python, stubDir, port, env = {} }) {
  const proc = spawn(python, [BRIDGE, String(port)], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      AGY_BIN: path.join(stubDir, 'agy'),
      BRIDGE_PORT: String(port),
      BRIDGE_PERMISSIVE: '1',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  proc.stdout.on('data', (d) => logs.push(d.toString()));
  proc.stderr.on('data', (d) => logs.push(d.toString()));

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const health = await waitForHealth(baseUrl);
    return { proc, baseUrl, logs, health };
  } catch (err) {
    proc.kill();
    throw new Error(`${err.message}\n--- bridge logs ---\n${logs.join('')}`);
  }
}

function stopBridge(proc) {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
  }
}

const python = pythonBin();

test('bridge.py exposes a local Antigravity CLI bridge for key-less runs', { skip: python ? false : 'python3 is required to run bridge.py' }, async (t) => {
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-stub-'));
  const recordPath = path.join(stubDir, 'record.json');
  fs.writeFileSync(path.join(stubDir, 'agy'), STUB_CLI, { mode: 0o755 });

  const port = await freePort();
  const { proc, baseUrl, health } = await startBridge({
    python,
    stubDir,
    port,
    env: { STUB_RECORD: recordPath }
  });
  t.after(() => stopBridge(proc));

  await t.test('health endpoint reports the detected CLI and version', () => {
    assert.equal(health.available, true, 'stub CLI must be detected through AGY_BIN');
    assert.equal(health.agent, path.join(stubDir, 'agy'), 'agent must point at the resolved binary');
    assert.match(health.version, /9\.9\.9-stub/, 'version must come from `agy --version`');
    assert.deepEqual(health.hints, [], 'no setup hints when the CLI is present');
  });

  await t.test('missing prompt is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  });

  await t.test('text prompts are executed through `agy -p --output-format json`', async () => {
    const res = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Write the minutes for this meeting.' })
    });
    assert.equal(res.status, 200, 'a successful CLI run must return HTTP 200');
    const body = await res.json();
    assert.equal(body.result, 'STUB MINUTES', 'the JSON envelope response must be unwrapped');

    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    assert.ok(record.argv.includes('--output-format'), 'bridge must request machine-readable output');
    assert.ok(record.argv.includes('--dangerously-skip-permissions'), 'headless runs need auto-approved tool use');
    assert.ok(record.argv.includes('-p'), 'the prompt must be passed with -p');
    assert.match(record.prompt, /Write the minutes for this meeting\./, 'the prompt reaches the CLI');
    assert.ok(!record.argv.includes('gemini-2.5-flash'), 'Gemini API model ids must not leak into the CLI call');
  });

  await t.test('audio from the browser is handed to the CLI as a real file and cleaned up afterwards', async () => {
    const audioBytes = Buffer.from('ID3 fake mp3 payload for the stub CLI');
    const res = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Produce meeting minutes.',
        audio: {
          base64: audioBytes.toString('base64'),
          mimeType: 'audio/mpeg',
          fileName: 'weekly sync 2026.mp3'
        }
      })
    });
    assert.equal(res.status, 200, 'audio runs must succeed against the stub');
    const body = await res.json();
    assert.equal(body.result, 'STUB MINUTES');

    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    const audioName = 'weekly_sync_2026.mp3';
    assert.equal(
      record.files[audioName],
      audioBytes.length,
      'the recording must exist in the CLI working directory with the exact bytes uploaded'
    );
    assert.match(
      record.prompt,
      new RegExp(`ATTACHED MEETING RECORDING: \\./${audioName}`),
      'the prompt must point the agent at the uploaded recording'
    );
    assert.ok(
      !fs.existsSync(record.cwd),
      'the temporary workspace holding the recording must be removed after the run'
    );
  });

  await t.test('plain-text CLI output still works (older CLI builds)', async () => {
    stopBridge(proc);
    const plainPort = await freePort();
    const plain = await startBridge({
      python,
      stubDir,
      port: plainPort,
      env: { STUB_RECORD: recordPath, STUB_MODE: 'plain' }
    });
    t.after(() => stopBridge(plain.proc));

    const res = await fetch(`${plain.baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Anything' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.result, 'PLAIN TEXT MINUTES', 'raw stdout must be used when the envelope is missing');
  });

  await t.test('sign-in failures surface a clear, actionable error', async () => {
    const authPort = await freePort();
    const auth = await startBridge({
      python,
      stubDir,
      port: authPort,
      env: { STUB_RECORD: recordPath, STUB_MODE: 'auth' }
    });
    t.after(() => stopBridge(auth.proc));

    const res = await fetch(`${auth.baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Anything' })
    });
    assert.equal(res.status, 502, 'a failed CLI run must not be reported as success');
    const body = await res.json();
    assert.match(body.error, /Authentication required/, 'the CLI error must be forwarded');
    assert.match(body.error, /sign in with your subscription/i, 'and must explain how to sign in reliably');
  });
});
