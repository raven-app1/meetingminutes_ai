const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { translations } = require('../js/i18n.js');

test('index.html contains mobile viewport, theme-color, and web app meta tags', () => {
  const htmlPath = path.join(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('viewport-fit=cover'), 'Viewport must include viewport-fit=cover for notched devices');
  assert.ok(html.includes('name="theme-color"'), 'Must include theme-color meta tag');
  assert.ok(html.includes('name="apple-mobile-web-app-capable"'), 'Must include iOS web app capable meta tag');
  assert.ok(html.includes('name="mobile-web-app-capable"'), 'Must include Android mobile web app capable meta tag');
  assert.ok(html.includes('id="mobileQuickJumpBtn"'), 'Must include mobile quick jump button in DOM');
  assert.ok(html.includes('class="exec-mode-switch"'), 'Must include exec-mode-switch class');
  assert.ok(html.includes('class="bridge-sub-actions"'), 'Must include bridge-sub-actions class');
  assert.ok(html.includes('class="audio-file-name"'), 'Must include audio-file-name class for responsive truncation');
  assert.ok(html.includes('class="empty-state-wrap"'), 'Must include empty-state-wrap class');
});

test('css/styles.css provides comprehensive mobile responsiveness', () => {
  const cssPath = path.join(__dirname, '../css/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Safe area CSS variables
  assert.ok(css.includes('--safe-top') && css.includes('--safe-bottom'), 'Must support env(safe-area-inset) variables');

  // Touch action & mobile resets
  assert.ok(css.includes('touch-action: manipulation'), 'Must optimize touch action for responsiveness');
  assert.ok(css.includes('-webkit-tap-highlight-color: transparent'), 'Must eliminate tap highlight flicker');
  assert.ok(css.includes('overflow-x: hidden'), 'Must prevent mobile horizontal page wobbling');

  // iOS Safari auto-zoom prevention (<input> font-size >= 16px)
  assert.ok(css.includes('font-size: 16px !important'), 'Must enforce 16px on inputs in mobile media queries to stop iOS Safari auto-zoom');

  // Mobile media queries
  assert.ok(css.includes('@media (max-width: 959px)'), 'Must include tablet/medium breakpoint');
  assert.ok(css.includes('@media (max-width: 768px)'), 'Must include portrait tablet/mobile breakpoint');
  assert.ok(css.includes('@media (max-width: 640px)'), 'Must include smartphone breakpoint');
  assert.ok(css.includes('@media (max-width: 480px)'), 'Must include narrow phone breakpoint');
  assert.ok(css.includes('@media (max-width: 360px)'), 'Must include ultra-narrow phone breakpoint');

  // Touch scrolling on horizontal action strips
  assert.ok(css.includes('-webkit-overflow-scrolling: touch'), 'Must enable momentum touch scrolling on scrollable containers');
  assert.ok(css.includes('.export-group'), 'Must style export group for mobile toolbar');
  assert.ok(css.includes('.mobile-jump-btn'), 'Must include floating mobile jump button styles');

  // Mobile Bottom sheet modal
  assert.ok(css.includes('modalSlideUp'), 'Must include slide-up transition for mobile bottom-sheet modal');
});

test('i18n includes mobile navigation keys in both Burmese and English', () => {
  assert.ok(translations.my.mobileJump, 'Burmese translations must have mobileJump');
  assert.ok(translations.my.mobileJumpTop, 'Burmese translations must have mobileJumpTop');
  assert.ok(translations.en.mobileJump, 'English translations must have mobileJump');
  assert.ok(translations.en.mobileJumpTop, 'English translations must have mobileJumpTop');
});

test('css keeps mobile grid tracks shrinkable so wide rows cannot blow out the page width', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  const compact = css.replace(/\s+/g, ' ');

  assert.ok(
    compact.includes('grid-template-columns: minmax(0, 1fr)'),
    'Main grid track must be minmax(0, 1fr): a 1fr track cannot shrink below its widest row'
  );
  assert.ok(
    compact.includes('grid-template-columns: minmax(0, 460px) minmax(0, 1fr)'),
    'Desktop grid tracks must stay shrinkable too'
  );
  assert.match(
    compact,
    /\.sidebar-col, \.main-content-col \{ min-width: 0; \}/,
    'Grid columns must be allowed to shrink below their content width'
  );
  assert.match(
    compact,
    /\.export-group \{ [^}]*min-width: 0;/,
    'Button strips must be shrinkable inside the result card'
  );
});

test('mobile tab and action strips wrap instead of hiding buttons off-screen', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  const compact = css.replace(/\s+/g, ' ');

  function mediaBlock(from, to) {
    const start = compact.indexOf(`@media (max-width: ${from}px)`);
    const end = compact.indexOf(`@media (max-width: ${to}px)`);
    assert.ok(start > -1 && end > start, `Expected the ${from}px media query block`);
    return compact.slice(start, end);
  }

  const portrait = mediaBlock(768, 640);
  const phone = mediaBlock(640, 480);

  assert.ok(
    portrait.includes('grid-template-columns: repeat(auto-fit, minmax(100px, 1fr))'),
    'Export actions must wrap into equal-width columns on phones, not scroll off-screen'
  );
  assert.match(portrait, /\.result-tabs \{ [^}]*flex-wrap: wrap;/, 'Result tabs must wrap into rows on phones');
  assert.match(phone, /\.nav-tabs \{ [^}]*flex-wrap: wrap;/, 'Nav tabs must wrap into rows on phones');
  assert.match(phone, /\.sub-tabs \{ [^}]*flex-wrap: wrap;/, 'Sub tabs must wrap into rows on phones');

  ['.result-tab-btn', '.export-group .btn', '.nav-tab-btn', '.sub-tab-btn'].forEach((selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      compact,
      new RegExp(`${escaped} \\{ [^}]*white-space: normal;`),
      `${selector} must allow its label to wrap on mobile instead of forcing nowrap overflow`
    );
  });
});

test('antigravity workflow cards use a responsive padding class instead of inline padding', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  const compact = css.replace(/\s+/g, ' ');

  assert.ok(html.includes('class="ag-method-card"'), 'Antigravity method cards must use the responsive card class');
  assert.ok(html.includes('id="method2BridgeCard"'), 'Bridge card id must be preserved for JS hooks');
  assert.ok(!html.includes('padding:1.5rem'), 'Card padding must not be hard-coded inline');
  assert.match(compact, /\.ag-method-card \{ [^}]*padding: 1\.5rem;/, 'Base card padding must live in the stylesheet');
  assert.ok(
    compact.includes('@media (max-width: 640px) { .app-header') &&
      compact.indexOf('.ag-method-card { padding: 1rem 0.85rem; }') > compact.indexOf('@media (max-width: 640px)'),
    'Card padding must be reduced on phones'
  );
});
