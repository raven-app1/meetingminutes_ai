const test = require('node:test');
const assert = require('node:assert/strict');
const { GEMINI_MODELS, normalizeAudioMimeType, generateWithGemini } = require('../js/gemini.js');

test('GEMINI_MODELS contains supported Gemini models with audio capability', () => {
  assert.ok(Array.isArray(GEMINI_MODELS));
  assert.ok(GEMINI_MODELS.length >= 3);
  const flash25 = GEMINI_MODELS.find(m => m.id === 'gemini-2.5-flash');
  assert.ok(flash25, 'gemini-2.5-flash should be present');
  assert.strictEqual(flash25.audioReady, true);
});

test('normalizeAudioMimeType detects and standardizes common audio extensions and mimes', () => {
  assert.strictEqual(normalizeAudioMimeType('audio/mpeg', 'meeting.mp3'), 'audio/mp3');
  assert.strictEqual(normalizeAudioMimeType('', 'meeting.wav'), 'audio/wav');
  assert.strictEqual(normalizeAudioMimeType('audio/x-m4a', 'record.m4a'), 'audio/mp4');
  assert.strictEqual(normalizeAudioMimeType('audio/aac', 'voice.aac'), 'audio/aac');
  assert.strictEqual(normalizeAudioMimeType('audio/ogg', 'note.ogg'), 'audio/ogg');
  assert.strictEqual(normalizeAudioMimeType('audio/webm', 'live.webm'), 'audio/webm');
  assert.strictEqual(normalizeAudioMimeType('audio/flac', 'hq.flac'), 'audio/flac');
});

test('generateWithGemini throws descriptive error when API key is missing', async () => {
  await assert.rejects(
    async () => {
      await generateWithGemini({ apiKey: '', prompt: 'test' });
    },
    {
      message: /Missing Google AI Studio API Key/
    }
  );
});
