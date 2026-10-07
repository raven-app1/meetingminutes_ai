const test = require('node:test');
const assert = require('node:assert/strict');
const { StorageManager } = require('../js/storage.js');

test('StorageManager handles settings gracefully in Node environment without crashing', () => {
  const sm = new StorageManager();
  assert.strictEqual(sm.getSetting('unknown_key', 'defaultVal'), 'defaultVal');
  // Shouldn't crash even when localStorage is undefined in Node
  sm.setSetting('some_key', 123);
  sm.removeSetting('some_key');
});

test('StorageManager saveMeeting and getAllMeetings work with fallback', async () => {
  const sm = new StorageManager();
  const sampleMeeting = {
    title: 'Test Meeting',
    content: '## Meeting content',
    mode: 'summary',
    language: 'bilingual'
  };

  const saved = await sm.saveMeeting(sampleMeeting);
  assert.ok(saved.id, 'Should generate an ID');
  assert.strictEqual(saved.title, 'Test Meeting');

  const all = await sm.getAllMeetings();
  assert.ok(Array.isArray(all));
  assert.ok(all.length >= 1);

  const found = await sm.getMeetingById(saved.id);
  assert.ok(found);
  assert.strictEqual(found.title, 'Test Meeting');

  const delResult = await sm.deleteMeeting(saved.id);
  assert.strictEqual(delResult, true);
});
