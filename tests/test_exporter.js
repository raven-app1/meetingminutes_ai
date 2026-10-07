const test = require('node:test');
const assert = require('node:assert/strict');
const { DocumentExporter } = require('../js/exporter.js');

test('DocumentExporter.markdownToHtml converts markdown elements accurately', () => {
  const md = `# အစည်းအဝေး ခေါင်းစဉ်
## အစီအစဉ် ၁
**အရေးကြီးသော** ဆုံးဖြတ်ချက်။

- အချက် ၁
- အချက် ၂

1. ပထမ
2. ဒုတိယ

> သဘာပတိ၏ အမှာစကား

| စဉ် | တာဝန် | တာဝန်ခံ |
|---|---|---|
| ၁ | စာရင်းစစ်ခြင်း | ဒေါ်နွယ်နွယ် |
`;

  const html = DocumentExporter.markdownToHtml(md);

  assert.ok(html.includes('<h1 class="minutes-h1">အစည်းအဝေး ခေါင်းစဉ်</h1>'), 'Should parse h1');
  assert.ok(html.includes('<h2 class="minutes-h2">အစီအစဉ် ၁</h2>'), 'Should parse h2');
  assert.ok(html.includes('<strong>အရေးကြီးသော</strong>'), 'Should parse bold');
  assert.ok(html.includes('<ul class="minutes-list">'), 'Should parse bullet list');
  assert.ok(html.includes('<ol class="minutes-ordered-list">'), 'Should parse ordered list');
  assert.ok(html.includes('<blockquote class="minutes-quote">'), 'Should parse blockquote');
  assert.ok(html.includes('<table class="minutes-table">'), 'Should parse table');
  assert.ok(html.includes('<th>စဉ်</th>'), 'Should have table header');
  assert.ok(html.includes('<td>စာရင်းစစ်ခြင်း</td>'), 'Should have table body cell');
});

test('DocumentExporter.markdownToHtml handles task list items', () => {
  const md = `- [ ] လုပ်ငန်း အစီအစဉ် ရေးဆွဲရန်
- [x] ဘတ်ဂျက် အတည်ပြုပြီး`;

  const html = DocumentExporter.markdownToHtml(md);
  assert.ok(html.includes('class="task-checkbox"'), 'Should render checkboxes');
  assert.ok(html.includes('checked'), 'Should render checked item');
});

test('DocumentExporter.extractActionItems extracts action items from Markdown tables', () => {
  const md = `
## လုပ်ဆောင်ရန် တာဝန်များ ဇယား

| စဉ် | လုပ်ဆောင်ရန် တာဝန် | တာဝန်ခံ | သတ်မှတ်ရက် | ဦးစားပေး |
|---|---|---|---|---|
| ၁ | Cloud Server Upgrade ပြုလုပ်ရန် | ကိုကျော်သူ | အောက်တိုဘာ ၉ | မြင့် |
| ၂ | Vendor Maintenance Contract ညှိနှိုင်းရန် | ဒေါ်နွယ်နွယ် | အောက်တိုဘာ ၁၂ | အလယ် |
`;

  const items = DocumentExporter.extractActionItems(md);
  assert.strictEqual(items.length, 2, 'Should extract exactly 2 items');
  assert.strictEqual(items[0].task.trim(), 'Cloud Server Upgrade ပြုလုပ်ရန်');
  assert.strictEqual(items[0].owner.trim(), 'ကိုကျော်သူ');
  assert.strictEqual(items[0].due.trim(), 'အောက်တိုဘာ ၉');
  assert.strictEqual(items[0].priority.trim(), 'မြင့်');
  assert.strictEqual(items[1].owner.trim(), 'ဒေါ်နွယ်နွယ်');
});

test('DocumentExporter.extractActionItems handles empty or invalid inputs gracefully', () => {
  assert.deepStrictEqual(DocumentExporter.extractActionItems(''), []);
  assert.deepStrictEqual(DocumentExporter.extractActionItems(null), []);
  assert.deepStrictEqual(DocumentExporter.extractActionItems('Just plain text without tables'), []);
});

test('DocumentExporter.extractActionItems extracts action items from Markdown checklists and parses metadata', () => {
  const md = `
### လုပ်ဆောင်ရန်များ (Action Items)
- [ ] Core API deploy လုပ်ရန် (တာဝန်ခံ: ကိုကျော်သူ, ရက်: အောက်တိုဘာ ၁၀, ဦးစားပေး: မြင့်)
- [x] Client feedback စစ်ဆေးပြီး (တာဝန်ခံ: မနှင်းဝေ)
`;

  const items = DocumentExporter.extractActionItems(md);
  assert.strictEqual(items.length, 2, 'Should extract 2 checklist items');
  assert.strictEqual(items[0].task.includes('Core API deploy လုပ်ရန်'), true);
  assert.strictEqual(items[0].owner, 'ကိုကျော်သူ');
  assert.strictEqual(items[0].due, 'အောက်တိုဘာ ၁၀');
  assert.strictEqual(items[0].priority, 'မြင့်');
  assert.strictEqual(items[0].completed, false);
  assert.strictEqual(items[1].completed, true);
  assert.strictEqual(items[1].owner, 'မနှင်းဝေ');
});

test('DocumentExporter.extractActionItems extracts bullet points under Action Items sections', () => {
  const md = `
## အဓိက ဆုံးဖြတ်ချက်များ

## နောက်ဆက်တွဲ လုပ်ဆောင်ရန် အစီအမံများ (Next Steps)
* Server upgrade စရိတ် တင်ပြရန် - Assignee: Ko Kyaw Thu - Due: Oct 15
* Marketing teaser လွှင့်တင်ရန် - Assignee: Ma Hnin Wai - Priority: High
`;

  const items = DocumentExporter.extractActionItems(md);
  assert.strictEqual(items.length, 2, 'Should extract 2 bullet items under action heading');
  assert.strictEqual(items[0].owner, 'Ko Kyaw Thu');
  assert.strictEqual(items[0].due, 'Oct 15');
  assert.strictEqual(items[1].owner, 'Ma Hnin Wai');
  assert.strictEqual(items[1].priority, 'High');
});
