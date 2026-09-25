'use strict';

// Nine desktop settings are display opt-outs. They used to be inert — the
// switches persisted a value no renderer read — so these tests pin the two things
// that make them real: the value resolution (including the fallback a browser
// host sees), and the markup each one actually controls.

const assert = require('node:assert/strict');
const test = require('node:test');
const { installDom } = require('../helpers/domShim');

const { configureViewContext, displayFlag } = require('../../src/shared-ui/core/viewContext.js');
const { t } = require('../../src/shared-ui/core/i18n.js');
const { maskAccountEmail } = require('../../src/shared-ui/core/data.js');

installDom(globalThis);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function withDesktopSettings(desktopSettings) {
  configureViewContext({
    tr: (key, params) => t('en', key, params),
    escapeHtml,
    state: { locale: 'en', desktopSettings }
  });
}

// The stored default lives in main.js and the fallback for a host with no
// settings document lives at each `displayFlag()` call site. If the two disagree, a
// fresh desktop install and the Hub dashboard render the same value differently.
const DEFAULTS = {
  showToolIcons: true,
  showLiveDot: true,
  showCompactTotalTokens: true,
  showHomeLimitBars: true,
  showHomeLimitProviderNames: true,
  showLimitSource: true,
  showLimitUsed: false,
  maskLimitAccountEmails: false,
  titleIconOnly: false
};

test('every display default is documented in the settings model', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const mainSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'electron', 'main.js'), 'utf8'
  );
  const block = mainSource.slice(
    mainSource.indexOf('function defaultSettings()'),
    mainSource.indexOf('function normalizeCollectionMode')
  );
  for (const [name, value] of Object.entries(DEFAULTS)) {
    // A default is either a bare literal or an env-seeded `parseBoolean(..., x)`.
    const pattern = new RegExp(`^\\s{4}${name}: (?:parseBoolean\\([^\\n]*, (true|false)\\)|(true|false))[,\\n]`, 'm');
    const match = pattern.exec(block);
    assert.ok(match, `${name} default is missing from defaultSettings()`);
    assert.equal(match[1] ?? match[2], String(value), `${name} default drifted`);
  }
});

test('every view fallback matches the stored default', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..', '..');
  const sources = ['src/shared-ui/app.js', 'src/shared-ui/views/home.js', 'src/shared-ui/views/limits.js', 'src/shared-ui/views/accounts.js']
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
  for (const [name, value] of Object.entries(DEFAULTS)) {
    const callSites = [...sources.matchAll(new RegExp(`displayFlag\\('${name}',\\s*(true|false)\\)`, 'g'))];
    assert.ok(callSites.length > 0, `${name} is not read by any view`);
    for (const match of callSites) {
      assert.equal(match[1], String(value), `${name} fallback disagrees with its default`);
    }
  }
});

test('a stored desktop value wins over the fallback', () => {
  withDesktopSettings({ showToolIcons: false, showLimitUsed: true, showCompactTotalTokens: false });
  assert.equal(displayFlag('showToolIcons', true), false);
  assert.equal(displayFlag('showLimitUsed', false), true);
  assert.equal(displayFlag('showCompactTotalTokens', true), false);
  // Untouched flags keep falling back.
  assert.equal(displayFlag('showLiveDot', true), true);
});

const card = {
  name: 'Work',
  provider: 'claude',
  status: 'ok',
  source: 'claude_oauth',
  accountEmail: 'ada@example.com',
  updatedAt: '2026-09-25T00:00:00.000Z',
  windows: [{ kind: 'session', label: '5-hour', remaining: 88, showMeter: true }]
};

function renderCards() {
  const { renderLimitCards } = require('../../src/shared-ui/views/limits.js');
  return renderLimitCards([card], { compact: true });
}

test('quota cards honour the icon, source and e-mail flags', () => {
  withDesktopSettings({});
  const plain = renderCards();
  assert.match(plain, /class="client-icon"/);
  assert.match(plain, /CLAUDE_OAUTH/);
  assert.match(plain, /ada@example\.com/);

  withDesktopSettings({ showToolIcons: false, showLimitSource: false, maskLimitAccountEmails: true });
  const stripped = renderCards();
  assert.doesNotMatch(stripped, /class="client-icon"/);
  assert.doesNotMatch(stripped, /CLAUDE_OAUTH/);
  assert.doesNotMatch(stripped, /ada@example\.com/);
  assert.match(stripped, /a•••@example\.com/);
});

test('masking keeps the domain so two accounts stay distinguishable', () => {
  assert.equal(maskAccountEmail('ada@example.com'), 'a•••@example.com');
  assert.equal(maskAccountEmail('bob.bobberson@other.test'), 'b•••@other.test');
  assert.equal(maskAccountEmail('not-an-address'), '•••');
  assert.equal(maskAccountEmail(''), '');
});

test('the quota bar can read as used or remaining', () => {
  const { renderSingleLimitWindow } = require('../../src/shared-ui/views/limits.js');
  withDesktopSettings({});
  assert.match(renderSingleLimitWindow(card.windows[0]), />88%</);
  assert.match(renderSingleLimitWindow(card.windows[0]), /width:88%/);

  withDesktopSettings({ showLimitUsed: true });
  const used = renderSingleLimitWindow(card.windows[0]);
  assert.match(used, />12%</);
  assert.match(used, /width:12%/);
  // The tone still describes what is left, so a nearly-exhausted quota keeps the
  // same colour whichever way the number is phrased.
  assert.match(used, /meter meter-ok/);
  assert.match(used, /remaining-tone-ok/);
});

// `syncShellDisplayFlags` (live dot + title strip body classes) lives in
// core/fluent.js, which statically imports the vendored Fluent component bundle
// and so cannot load outside a browser. It is covered by the Playwright acceptance
// run instead: scripts/browser/fluent-acceptance.js.
