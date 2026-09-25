'use strict';

// The native shell — menu bar, tray, and the desktop settings view's option
// labels — renders strings no browser view uses. They used to live in a second
// catalog (src/electron/i18n.js) that lost every `menu.*` and `nav.*` string the
// Fluent redesign added, so the menu bar showed raw keys and `auto` resolved to
// English because no renderer `navigator` exists in the main process. There is
// one catalog now; these guards keep it that way.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  MESSAGE_KEYS,
  SUPPORTED_LOCALES,
  resolveLocale,
  t: translate
} = require('../../src/shared-ui/core/i18n.js');

const REPO_ROOT = path.join(__dirname, '..', '..');

function keysReferencedFrom(relativeFiles, namespaces) {
  const pattern = new RegExp(`'((?:${namespaces.join('|')})\\.[A-Za-z0-9_.]+)'`, 'g');
  const keys = new Set();
  for (const file of relativeFiles) {
    const source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    for (const match of source.matchAll(pattern)) keys.add(match[1]);
  }
  return [...keys].sort();
}

function untranslated(keys) {
  const offenders = [];
  for (const key of keys) {
    for (const locale of SUPPORTED_LOCALES) {
      if (!MESSAGE_KEYS[locale].includes(key)) offenders.push(`${key} (${locale})`);
    }
  }
  return offenders;
}

test('the main process localizes from the shared catalog, not a second copy', () => {
  const mainSource = fs.readFileSync(path.join(REPO_ROOT, 'src', 'electron', 'main.js'), 'utf8');
  assert.match(mainSource, /require\('\.\.\/shared-ui\/core\/i18n\.js'\)/);
  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, 'src', 'electron', 'i18n.js')),
    'a second main-process catalog drifts from the one the views render'
  );
});

test('every native menu and tray string is translated in every bundled locale', () => {
  const keys = keysReferencedFrom(['src/electron/appMenu.js', 'src/electron/tray.js'], ['menu', 'nav', 'trayMenu']);
  assert.ok(keys.length >= 15, `expected the native shell to reference its labels, saw ${keys.length}`);
  assert.deepEqual(untranslated(keys), []);
});

test('every desktop settings label is translated in every bundled locale', () => {
  const keys = keysReferencedFrom(['src/shared-ui/views/settingsDesktop.js'], ['desktop.settings', 'settings.appearance']);
  assert.ok(keys.length >= 50, `expected the desktop settings view to reference its labels, saw ${keys.length}`);
  assert.deepEqual(untranslated(keys), []);
});

test('no locale relies on the English fallback', () => {
  const english = [...MESSAGE_KEYS.en].sort();
  for (const locale of SUPPORTED_LOCALES.filter((code) => code !== 'en')) {
    const missing = english.filter((key) => !MESSAGE_KEYS[locale].includes(key));
    const extra = MESSAGE_KEYS[locale].filter((key) => !english.includes(key));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${locale} drifted from English`);
  }
});

test('auto resolves from an explicit system locale list', () => {
  // The main process passes app.getLocale(); a browser leaves it null and reads
  // navigator. Both must reach the same dictionary.
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(resolveLocale('auto', [locale]), locale, `auto should resolve a ${locale} system locale`);
    assert.equal(resolveLocale(locale, ['en']), locale, `${locale} stays selected over the system locale`);
  }
  assert.equal(resolveLocale('auto', ['zh-HK']), 'zh-TW');
  assert.equal(resolveLocale('auto', ['zh-Hans-CN']), 'zh-CN');
  assert.equal(resolveLocale('auto', ['fr']), 'en');
  assert.equal(resolveLocale('auto', []), 'en');
});

test('translate interpolates params and falls back to the key', () => {
  // The key fallback is what made the original bug invisible: the menu bar showed
  // `menu.file` rather than throwing, so nothing looked broken in the renderer.
  assert.equal(translate('en', 'menu.repository'), 'GitHub Repository');
  assert.equal(translate('zh-CN', 'trayMenu.quit'), '退出 Token Monitor');
  assert.equal(translate('ja', 'settings.appearance.glassEffectTransparent'), '透明');
  const interpolated = translate('zh-TW', 'limits.accountsCount', { count: 2 });
  assert.ok(interpolated.includes('2') && !interpolated.includes('{count'), interpolated);
  assert.equal(translate('en', 'definitely.not.a.key'), 'definitely.not.a.key');
});
