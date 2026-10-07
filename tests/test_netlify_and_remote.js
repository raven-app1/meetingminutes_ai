const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AntigravityHelper } = require('../js/antigravity.js');

test('netlify.toml exists and contains required static configuration', () => {
  const tomlPath = path.join(__dirname, '../netlify.toml');
  assert.ok(fs.existsSync(tomlPath), 'netlify.toml must exist in root directory');

  const content = fs.readFileSync(tomlPath, 'utf8');
  assert.ok(content.includes('publish = "."'), 'Must configure publish = "."');
  assert.ok(content.includes('[[redirects]]'), 'Must configure redirects');
  assert.ok(content.includes('status = 200'), 'Must redirect with status 200 for SPA');
  assert.ok(content.includes('[[headers]]'), 'Must configure security and content headers');
  assert.ok(content.includes('Permissions-Policy'), 'Must configure Permissions-Policy for microphone recording');
  assert.ok(content.includes('charset=utf-8'), 'Must enforce UTF-8 charset for Myanmar Unicode');
});

test('_redirects and _headers exist for Netlify Drag-and-Drop compatibility', () => {
  const redirectsPath = path.join(__dirname, '../_redirects');
  const headersPath = path.join(__dirname, '../_headers');

  assert.ok(fs.existsSync(redirectsPath), '_redirects must exist');
  assert.ok(fs.existsSync(headersPath), '_headers must exist');

  const redirectsContent = fs.readFileSync(redirectsPath, 'utf8');
  assert.ok(/\/index\.html\s+200/.test(redirectsContent), '_redirects must rewrite to index.html with 200');

  const headersContent = fs.readFileSync(headersPath, 'utf8');
  assert.ok(headersContent.includes('Permissions-Policy'), '_headers must configure Permissions-Policy');
  assert.ok(headersContent.includes('charset=utf-8'), '_headers must configure UTF-8');
});

test('package.json contains build script for Netlify CI/CD', () => {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.ok(pkg.scripts && pkg.scripts.build, 'package.json must contain "build" script');
  assert.ok(typeof pkg.scripts.build === 'string', 'build script must be string');
});

test('AntigravityHelper detects remote host / HTTPS environment correctly', () => {
  // 1. Force remote simulation
  const remoteHelper = new AntigravityHelper({ forceRemote: true });
  assert.strictEqual(remoteHelper.isRemoteOrHttps(), true);
  const info = remoteHelper.getDeploymentInfo();
  assert.strictEqual(info.isRemote, true);
  assert.strictEqual(info.zeroDependencyMode, true);
  assert.strictEqual(info.recommendedMode, 'gemini_web_or_api');

  // 2. Force local simulation
  const localHelper = new AntigravityHelper({ forceRemote: false });
  assert.strictEqual(localHelper.isRemoteOrHttps(), false);
});

test('AntigravityHelper.checkBridgeHealth skips fetch on remote host to prevent mixed content', async () => {
  const remoteHelper = new AntigravityHelper({ forceRemote: true });
  const health = await remoteHelper.checkBridgeHealth();

  assert.strictEqual(health.available, false);
  assert.strictEqual(health.isRemote, true);
  assert.strictEqual(health.reason, 'remote_or_https');
});

test('AntigravityHelper.executeViaLocalBridge rejects on remote host with clear guidance', async () => {
  const remoteHelper = new AntigravityHelper({ forceRemote: true });

  await assert.rejects(
    async () => {
      await remoteHelper.executeViaLocalBridge({ prompt: 'test' });
    },
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('Netlify'), 'Error message should mention Netlify/remote deployment');
      assert.ok(err.message.includes('Gemini Web'), 'Error message should guide towards Gemini Web');
      return true;
    }
  );
});

test('index.html contains Quick Paste Modal, studio quick paste button, and cloud notices', () => {
  const htmlPath = path.join(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="pasteModal"'), 'Must contain pasteModal element');
  assert.ok(html.includes('id="modalPasteInput"'), 'Must contain modalPasteInput');
  assert.ok(html.includes('id="btnOpenPasteModal"'), 'Must contain btnOpenPasteModal in toolbar');
  assert.ok(html.includes('id="btnEmptyStatePaste"'), 'Must contain btnEmptyStatePaste in empty state');
  assert.ok(html.includes('id="btnQuickPasteStudio"'), 'Must contain btnQuickPasteStudio in subaction grid');
  assert.ok(html.includes('id="cloudNoticeBox"'), 'Must contain cloudNoticeBox in Method 2');
  assert.ok(html.includes('id="txt-method2DevBadge"'), 'Must contain txt-method2DevBadge');
});

test('netlify.toml and _headers avoid stale 1-year caching on unhashed static assets', () => {
  const tomlPath = path.join(__dirname, '../netlify.toml');
  const headersPath = path.join(__dirname, '../_headers');

  const tomlContent = fs.readFileSync(tomlPath, 'utf8');
  const headersContent = fs.readFileSync(headersPath, 'utf8');

  // Should NOT contain max-age=31536000 or immutable on unversioned CSS/JS paths
  assert.ok(!tomlContent.includes('31536000'), 'netlify.toml should not lock unversioned assets for 1 year');
  assert.ok(!headersContent.includes('31536000'), '_headers should not lock unversioned assets for 1 year');
  assert.ok(tomlContent.includes('must-revalidate'), 'netlify.toml should enforce revalidation');
  assert.ok(headersContent.includes('must-revalidate'), '_headers should enforce revalidation');
});

test('AntigravityHelper generates localized Burmese guide when uiLang is "my"', () => {
  const helper = new AntigravityHelper();
  const bundleMy = helper.buildGeminiWebBundle({
    mode: 'summary',
    uiLang: 'my',
    isAudioInput: true
  });

  assert.ok(bundleMy.fullBundle.includes('လမ်းညွှန်'), 'Should include Burmese guide title');
  assert.ok(bundleMy.fullBundle.includes('gemini.google.com'), 'Should link to Gemini Web');
  assert.ok(bundleMy.fullBundle.includes('Upload Audio'), 'Should explain audio attachment');
});
