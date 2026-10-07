const test = require('node:test');
const assert = require('node:assert/strict');
const { AntigravityHelper } = require('../js/antigravity.js');
const { buildGeminiPrompt } = require('../js/modes.js');

// Mock global buildGeminiPrompt if needed
global.buildGeminiPrompt = buildGeminiPrompt;

test('AntigravityHelper builds complete prompt bundle for Gemini Web', () => {
  const helper = new AntigravityHelper();
  const bundle = helper.buildGeminiWebBundle({
    mode: 'formal',
    language: 'pure_my',
    meetingTitle: 'Board of Directors Meeting'
  });

  assert.ok(bundle.promptOnly, 'Should contain promptOnly');
  assert.ok(bundle.fullBundle, 'Should contain fullBundle');
  assert.ok(bundle.fullBundle.includes('gemini.google.com'), 'Should link to Gemini Web');
  assert.ok(bundle.fullBundle.includes('Board of Directors Meeting'), 'Should include title');
  assert.ok(bundle.fullBundle.includes('Formal Corporate Minutes'), 'Should include selected mode');
  assert.ok(bundle.fullBundle.includes('မြန်မာဘာသာ သီးသန့်'), 'Should include language requirement');
});

test('AntigravityHelper checkBridgeHealth returns available:false when bridge is offline', async () => {
  const helper = new AntigravityHelper();
  const health = await helper.checkBridgeHealth();
  assert.strictEqual(health.available, false);
});

test('AntigravityHelper.buildCliPayload forwards audio for key-less CLI runs', async () => {
  const helper = new AntigravityHelper();

  const textOnly = await helper.buildCliPayload({ prompt: 'Make minutes' });
  assert.deepStrictEqual(textOnly, { prompt: 'Make minutes' }, 'Text runs must not invent an audio payload');

  const withAudio = await helper.buildCliPayload({
    prompt: 'Make minutes',
    audioBase64: 'QUJD',
    audioMimeType: 'audio/mpeg',
    audioName: 'weekly sync.mp3',
    effort: 'low'
  });

  assert.strictEqual(withAudio.audio.base64, 'QUJD', 'Base64 audio must reach the bridge');
  assert.strictEqual(withAudio.audio.mimeType, 'audio/mpeg');
  assert.strictEqual(withAudio.audio.fileName, 'weekly sync.mp3');
  assert.strictEqual(withAudio.effort, 'low', 'Optional CLI effort must be forwarded when set');
});

test('AntigravityHelper.verifyBridge never calls the local bridge on remote hosts', async () => {
  const helper = new AntigravityHelper({ forceRemote: true });
  const result = await helper.verifyBridge();
  assert.strictEqual(result.available, false);
  assert.strictEqual(result.reason, 'remote_or_https');
});

test('AntigravityHelper includes transcriptText in prompt bundle when provided', () => {
  const helper = new AntigravityHelper();
  const bundle = helper.buildGeminiWebBundle({
    mode: 'summary',
    transcriptText: 'သဘာပတိ: မင်္ဂလာပါ အားလုံးပဲ'
  });

  assert.ok(bundle.fullBundle.includes('သဘာပတိ: မင်္ဂလာပါ အားလုံးပဲ'));
  assert.ok(bundle.promptOnly.includes('MEETING TRANSCRIPT / SPOKEN NOTES:'));
});
