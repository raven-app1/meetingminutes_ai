const test = require('node:test');
const assert = require('node:assert/strict');
const { translations } = require('../js/i18n.js');

test('i18n dictionary contains both "my" (Burmese) and "en" (English)', () => {
  assert.ok(translations.my, 'Translations should have "my"');
  assert.ok(translations.en, 'Translations should have "en"');
});

test('All keys in English exist in Burmese and vice-versa', () => {
  const enKeys = Object.keys(translations.en);
  const myKeys = Object.keys(translations.my);

  enKeys.forEach(k => {
    assert.ok(translations.my[k], `Key "${k}" exists in "en" but missing in "my"`);
    assert.strictEqual(typeof translations.my[k], 'string', `Value for "${k}" in "my" must be string`);
  });

  myKeys.forEach(k => {
    assert.ok(translations.en[k], `Key "${k}" exists in "my" but missing in "en"`);
    assert.strictEqual(typeof translations.en[k], 'string', `Value for "${k}" in "en" must be string`);
  });
});

test('Burmese translations contain valid Myanmar Unicode characters', () => {
  const burmeseSampleKeys = ['appTitle', 'step1Title', 'generateBtn', 'modeSummary'];
  const myanmarRegex = /[\u1000-\u109F]/; // Unicode range for Myanmar script

  burmeseSampleKeys.forEach(key => {
    const val = translations.my[key];
    assert.ok(myanmarRegex.test(val), `Key "${key}" should contain Myanmar characters: "${val}"`);
  });
});
