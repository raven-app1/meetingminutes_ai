const test = require('node:test');
const assert = require('node:assert/strict');
const { AudioEngine } = require('../js/audio.js');
const { createSyntheticDemoAudio, SAMPLE_MEETING } = require('../js/sample-data.js');
const { DocumentExporter } = require('../js/exporter.js');
const { buildGeminiPrompt, AI_MODES } = require('../js/modes.js');

test('AudioEngine formatTime formats seconds correctly', () => {
  const engine = new AudioEngine();
  assert.strictEqual(engine.formatTime(0), '00:00');
  assert.strictEqual(engine.formatTime(59), '00:59');
  assert.strictEqual(engine.formatTime(60), '01:00');
  assert.strictEqual(engine.formatTime(125), '02:05');
  assert.strictEqual(engine.formatTime(3600), '01:00:00');
  assert.strictEqual(engine.formatTime(3665), '01:01:05');
  assert.strictEqual(engine.formatTime(NaN), '00:00');
  assert.strictEqual(engine.formatTime(-5), '00:00');
});

test('AudioEngine formatBytes formats sizes correctly', () => {
  const engine = new AudioEngine();
  assert.strictEqual(engine.formatBytes(0), '0 Bytes');
  assert.strictEqual(engine.formatBytes(1024), '1 KB');
  assert.strictEqual(engine.formatBytes(1024 * 1024), '1 MB');
  assert.strictEqual(engine.formatBytes(15 * 1024 * 1024), '15 MB');
});

test('Synthetic demo audio generates valid RIFF WAVE buffer', () => {
  const blob = createSyntheticDemoAudio();
  assert.ok(blob, 'Blob should be created');
  assert.strictEqual(blob.type, 'audio/wav');
  assert.ok(blob.size > 1000, 'Audio blob should have substantial data');
});

test('SAMPLE_MEETING contains realistic Burmese business data', () => {
  assert.ok(SAMPLE_MEETING.title);
  assert.ok(SAMPLE_MEETING.rawTranscript.includes('ဦးသန်းထိုက်'));
  assert.ok(SAMPLE_MEETING.rawTranscript.includes('Cloud Server'));
  assert.ok(SAMPLE_MEETING.rawTranscript.includes('ဘတ်ဂျက်'));
  assert.ok(SAMPLE_MEETING.sampleOutputs.summary);
  assert.ok(SAMPLE_MEETING.sampleOutputs.action_items);
});

test('DocumentExporter handles malicious HTML and script tags safely', () => {
  const malicious = '<script>alert("xss")</script>**Bold text**';
  const html = DocumentExporter.markdownToHtml(malicious);
  assert.ok(!html.includes('<script>'), 'Raw script tag should not be injected');
  assert.ok(html.includes('&lt;script&gt;'), 'Script tag should be escaped');
  assert.ok(html.includes('<strong>Bold text</strong>'), 'Bold text should still format');
});

test('DocumentExporter handles complex multi-column Myanmar tables', () => {
  const tableMd = `
| စဉ် | ခေါင်းစဉ် | ဆွေးနွေးချက် | ဆုံးဖြတ်ချက် |
| :--- | :--- | :--- | :--- |
| ၁ | Server Upgrade | AWS ကုန်ကျစရိတ် မြင့်တက်လာခြင်း | US$ 1500 အတည်ပြု |
| ၂ | Payment Terms | ၃ လတစ်ကြိမ် ပေးချေရန် | သဘောတူညီခဲ့ |
`;
  const html = DocumentExporter.markdownToHtml(tableMd);
  assert.ok(html.includes('<table class="minutes-table">'));
  assert.ok(html.includes('<td>US$ 1500 အတည်ပြု</td>'));
});

test('All AI modes generate specific Burmese instructions', () => {
  const modes = Object.keys(AI_MODES);
  modes.forEach(m => {
    const prompt = buildGeminiPrompt({ mode: m, language: 'bilingual' });
    assert.ok(prompt.includes(AI_MODES[m].nameEn), `Prompt should contain ${AI_MODES[m].nameEn}`);
    assert.ok(prompt.length > 300, `Prompt for ${m} should be detailed`);
  });
});

test('AudioEngine initializes onError and onSpeechTranscript callbacks correctly', () => {
  const engine = new AudioEngine();
  assert.strictEqual(engine.onError, null);
  assert.strictEqual(engine.onSpeechTranscript, null);
  assert.strictEqual(typeof engine.formatTime, 'function');
  assert.strictEqual(typeof engine.formatBytes, 'function');
});
