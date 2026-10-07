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
