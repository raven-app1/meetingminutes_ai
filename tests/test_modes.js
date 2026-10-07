const test = require('node:test');
const assert = require('node:assert/strict');
const { AI_MODES, buildGeminiPrompt } = require('../js/modes.js');

test('AI_MODES defines all required modes with metadata', () => {
  const expectedModes = ['summary', 'detailed', 'action_items', 'discussion', 'formal', 'transcript'];
  expectedModes.forEach(modeKey => {
    assert.ok(AI_MODES[modeKey], `Missing mode: ${modeKey}`);
    assert.ok(AI_MODES[modeKey].nameEn, `Missing nameEn for ${modeKey}`);
    assert.ok(AI_MODES[modeKey].nameMy, `Missing nameMy for ${modeKey}`);
    assert.ok(AI_MODES[modeKey].promptInstruction, `Missing promptInstruction for ${modeKey}`);
  });
});

test('buildGeminiPrompt generates prompt with default settings', () => {
  const prompt = buildGeminiPrompt();
  assert.ok(prompt.includes('Burmese'), 'Should mention Burmese language');
  assert.ok(prompt.includes('Detailed Minutes'), 'Default should be detailed minutes');
  assert.ok(prompt.includes('BILINGUAL'), 'Default should be bilingual');
});

test('buildGeminiPrompt handles all language options correctly', () => {
  // Pure Burmese
  const pureMyPrompt = buildGeminiPrompt({ language: 'pure_my' });
  assert.ok(pureMyPrompt.includes('မြန်မာဘာသာ သီးသန့်'));

  // English Translation
  const engPrompt = buildGeminiPrompt({ language: 'english' });
  assert.ok(engPrompt.includes('FINAL OUTPUT IN PROFESSIONAL ENGLISH'));

  // Bilingual
  const biPrompt = buildGeminiPrompt({ language: 'bilingual' });
  assert.ok(biPrompt.includes('BILINGUAL / BUSINESS BURMESE'));
});

test('buildGeminiPrompt includes meeting title and custom instructions', () => {
  const prompt = buildGeminiPrompt({
    meetingTitle: 'Annual Financial Review 2026',
    customPrompt: 'Focus on cloud budget savings',
    mode: 'action_items'
  });

  assert.ok(prompt.includes('Annual Financial Review 2026'));
  assert.ok(prompt.includes('Focus on cloud budget savings'));
  assert.ok(prompt.includes('Action Items & Decisions'));
  assert.ok(prompt.includes('Markdown table'));
});

test('buildGeminiPrompt handles edge cases: empty strings, unknown mode fallback', () => {
  const promptEmpty = buildGeminiPrompt({
    meetingTitle: '',
    customPrompt: '',
    mode: 'non_existent_mode'
  });
  assert.ok(promptEmpty.length > 100);
  assert.ok(promptEmpty.includes('Detailed Minutes')); // falls back to detailed
});
