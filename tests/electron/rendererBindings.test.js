'use strict';

// Guards the renderer bootstrap contract.
//
// Background: the restricted local/client refactor removed markup but left the
// JS behind. `els.saveSettingsButton.addEventListener(...)` was a *top-level*
// statement, so a single missing element threw during script evaluation and the
// remaining ~1900 lines (including init() and the stats subscription) never ran,
// leaving the widget stuck on the static skeleton with no visible error.
//
// These assertions are cheap, purely static, and catch exactly that class of
// drift: an id the JS expects, an unguarded top-level dereference, or markup that
// references a translation key no locale defines.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..', '..');
const rendererDir = path.join(rootDir, 'src', 'electron', 'renderer');

function readRenderer(name) {
  return fs.readFileSync(path.join(rendererDir, name), 'utf8');
}

const appSource = readRenderer('app.js');
const indexHtml = readRenderer('index.html');
const dashboardHtml = readRenderer('dashboard.html');
const i18n = require(path.join(rendererDir, 'i18n.js'));

// Ids that no current markup provides. Each entry must be dereferenced behind a
// guard, and the list is deliberately explicit so adding a third one is a
// conscious decision rather than an accident.
const KNOWN_ABSENT_IDS = new Set(['deviceIdInput']);

function elsMapSources() {
  // The map is built in two passes: a `const els = {...}` literal and a later
  // `Object.assign(els, {...})` that adds the settings/app-update surface.
  const blocks = [];
  const literalStart = appSource.indexOf('const els = {');
  assert.notEqual(literalStart, -1, 'the els literal should exist');
  const literalEnd = appSource.indexOf('\n};', literalStart);
  assert.notEqual(literalEnd, -1, 'the els literal should be terminated');
  blocks.push(appSource.slice(literalStart, literalEnd));

  const assignStart = appSource.indexOf('Object.assign(els, {');
  assert.notEqual(assignStart, -1, 'the Object.assign(els, ...) block should exist');
  const assignEnd = appSource.indexOf('\n});', assignStart);
  assert.notEqual(assignEnd, -1, 'the Object.assign block should be terminated');
  blocks.push(appSource.slice(assignStart, assignEnd));

  return blocks;
}

function elsEntries() {
  const entries = [];
  for (const block of elsMapSources()) {
    for (const match of block.matchAll(/([A-Za-z0-9_]+):\s*(?:Array\.from\()?document\.([A-Za-z]+)\('([^']+)'\)/g)) {
      entries.push({ prop: match[1], method: match[2], selector: match[3] });
    }
  }
  assert.ok(entries.length > 100, `expected the els map to stay populated, parsed ${entries.length}`);
  return entries;
}

function markupIds() {
  const ids = new Set();
  for (const html of [indexHtml, dashboardHtml]) {
    for (const match of html.matchAll(/\sid="([^"]+)"/g)) ids.add(match[1]);
  }
  return ids;
}

test('every els.getElementById binding exists in the renderer markup', () => {
  const ids = markupIds();
  const missing = elsEntries()
    .filter((entry) => entry.method === 'getElementById')
    .filter((entry) => !ids.has(entry.selector))
    .map((entry) => `${entry.selector} (els.${entry.prop})`);

  const unexpected = missing.filter((label) => !KNOWN_ABSENT_IDS.has(label.split(' ')[0]));
  assert.deepEqual(
    unexpected,
    [],
    `markup no longer provides: ${unexpected.join(', ')} — add the element or guard the binding`
  );
});

test('every top-level els property access targets an element the markup provides', () => {
  // Only column-0 statements are top-level: a throw there aborts the module, so
  // these are the bindings that must never point at a missing element. Bindings
  // that *are* allowed to be absent must use optional chaining (`?.`).
  const ids = markupIds();
  const byProp = new Map(elsEntries().map((entry) => [entry.prop, entry]));
  const offenders = [];

  for (const line of appSource.split('\n')) {
    const match = line.match(/^els\.([A-Za-z0-9_]+)(\??)\./);
    if (!match) continue;
    const [, prop, optional] = match;
    const entry = byProp.get(prop);
    if (!entry) {
      offenders.push(`els.${prop} has no els map entry`);
      continue;
    }
    const provided = entry.method !== 'getElementById' || ids.has(entry.selector);
    if (!provided && optional !== '?') {
      offenders.push(`els.${prop} -> #${entry.selector} is not in the markup; use els.${prop}?.`);
    }
  }

  assert.deepEqual(offenders, [], `unguarded top-level bindings:\n${offenders.join('\n')}`);
});

test('known-absent els bindings are dereferenced only behind a guard', () => {
  for (const id of KNOWN_ABSENT_IDS) {
    const prop = elsEntries().find((entry) => entry.selector === id)?.prop;
    if (!prop) continue;
    const usages = [];
    const pattern = new RegExp(`\\bels\\.${prop}\\b`, 'g');
    let match;
    while ((match = pattern.exec(appSource)) !== null) {
      // Skip the map declaration itself.
      const lineStart = appSource.lastIndexOf('\n', match.index) + 1;
      const line = appSource.slice(lineStart, appSource.indexOf('\n', match.index));
      if (/^\s*[A-Za-z0-9_]+:\s*document\./.test(line)) continue;
      usages.push({ line, index: match.index });
    }
    assert.ok(usages.length > 0, `els.${prop} should still be referenced`);
    for (const usage of usages) {
      const guarded = /if\s*\(\s*els\.[A-Za-z0-9_]+\s*\)/.test(usage.line)
        || new RegExp(`els\\.${prop}\\?\\.`).test(usage.line);
      assert.ok(
        guarded,
        `els.${prop} points at #${id}, which no markup provides, so it must be guarded: ${usage.line.trim().slice(0, 90)}`
      );
    }
  }
});

test('renderer markup translation keys all resolve in every locale', () => {
  const keyPattern = /data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g;
  const referenced = new Set();
  for (const html of [indexHtml, dashboardHtml]) {
    for (const match of html.matchAll(keyPattern)) referenced.add(match[1]);
  }
  assert.ok(referenced.size > 100, `expected many markup keys, found ${referenced.size}`);

  const locales = Object.keys(i18n.MESSAGES);
  const missing = [];
  for (const key of referenced) {
    for (const locale of locales) {
      if (i18n.MESSAGES[locale]?.[key] === undefined) missing.push(`${locale}:${key}`);
    }
  }
  assert.deepEqual(missing, [], `markup references keys absent from a locale: ${missing.slice(0, 20).join(', ')}`);
});

test('the hub connection fields stay persistable from the UI', () => {
  // Regression guard for the refactor that deleted #saveSettingsButton while the
  // hubUrl/secret/insecure-http inputs remained: the only writer lived in the
  // dead handler, so the widget could not be pointed at a Hub from its own UI.
  const ids = markupIds();
  for (const id of ['hubUrlInput', 'secretInput', 'allowInsecureHubHttpInput']) {
    assert.ok(ids.has(id), `#${id} should exist in the sync section`);
  }
  assert.ok(ids.has('saveSettingsButton'), '#saveSettingsButton should exist so the connection can be saved');
  assert.match(appSource, /els\.saveSettingsButton\?\.addEventListener\('click'/);
  const handler = appSource.slice(appSource.indexOf("els.saveSettingsButton?.addEventListener('click'"));
  assert.match(handler.slice(0, 400), /hubUrl:\s*els\.hubUrlInput\.value\.trim\(\)/);
  assert.match(handler.slice(0, 400), /secret:\s*els\.secretInput\.value/);
});

test('the renderer limit-provider list matches the shared canonical list', () => {
  // The renderer used to hand-maintain this list and had silently dropped
  // `commandcode` and `thirdparty`: those providers could not be displayed,
  // reordered, or kept in a saved settings round-trip (the renderer rewrote the
  // stored list down to its own shorter copy).
  const shared = require(path.join(rootDir, 'src', 'shared', 'limitProviders.js')).LIMIT_PROVIDER_IDS;

  assert.match(
    indexHtml,
    /<script src="\.\.\/\.\.\/shared\/limitProviders\.js"><\/script>/,
    'index.html must load the shared provider list before app.js so the runtime global exists'
  );

  const labelsBlock = appSource.match(/const LIMIT_PROVIDER_LABELS = \{([\s\S]*?)\n\};/);
  assert.ok(labelsBlock, 'LIMIT_PROVIDER_LABELS should exist');
  const labelIds = [...labelsBlock[1].matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\{/gm)].map((match) => match[1]);

  const missing = shared.filter((id) => !labelIds.includes(id));
  const extra = labelIds.filter((id) => !shared.includes(id));
  assert.deepEqual(missing, [], `shared providers with no renderer label: ${missing.join(', ')}`);
  assert.deepEqual(extra, [], `renderer labels for unknown providers: ${extra.join(', ')}`);
});

test('every limit provider has an icon rule and a capability tag translation', () => {
  const shared = require(path.join(rootDir, 'src', 'shared', 'limitProviders.js')).LIMIT_PROVIDER_IDS;
  const styles = readRenderer('styles.css');
  const missingIcons = shared.filter((id) => !styles.includes(`.limit-icon-${id} {`));
  assert.deepEqual(missingIcons, [], `providers without a .limit-icon rule: ${missingIcons.join(', ')}`);

  // Every capability tag the presentation layer can emit must resolve to a key
  // that every locale defines, otherwise the row renders raw English.
  const presentation = readRenderer('limitProviderPresentation.js');
  const tagsBlock = presentation.match(/const CAPABILITY_TAGS = \{([\s\S]*?)\n {2}\};/);
  assert.ok(tagsBlock, 'CAPABILITY_TAGS should exist');
  const tagKeysBlock = appSource.match(/const LIMIT_CAPABILITY_TAG_KEYS = \{([\s\S]*?)\n\};/);
  assert.ok(tagKeysBlock, 'LIMIT_CAPABILITY_TAG_KEYS should exist');
  const knownTags = new Set(
    [...tagKeysBlock[1].matchAll(/^\s*'?([^':\n]+?)'?:\s*'/gm)].map((match) => match[1].trim())
  );
  const usedTags = new Set();
  for (const match of tagsBlock[1].matchAll(/\[([^\]]+)\]/g)) {
    for (const tag of match[1].matchAll(/'([^']+)'/g)) usedTags.add(tag[1]);
  }
  const unmapped = [...usedTags].filter((tag) => !knownTags.has(tag));
  assert.deepEqual(unmapped, [], `capability tags with no translation key: ${unmapped.join(', ')}`);

  const locales = Object.keys(i18n.MESSAGES);
  const missingTranslations = [];
  for (const tag of usedTags) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mapped = tagKeysBlock[1].match(new RegExp(`^\\s*'?${escapedTag}'?:\\s*'([^']+)'`, 'm'));    if (!mapped) continue;
    for (const locale of locales) {
      if (i18n.MESSAGES[locale]?.[mapped[1]] === undefined) missingTranslations.push(`${locale}:${mapped[1]}`);
    }
  }
  assert.deepEqual(missingTranslations, [], `capability tags missing translations: ${missingTranslations.join(', ')}`);
});

test('the generated tray icon is fingerprint-gated', () => {
  // It used to re-rasterize a 44px canvas through toDataURL on every stats push
  // (every 3-5s in live mode) even when nothing that affects the bitmap changed,
  // and even when the tray icon was hidden.
  assert.match(appSource, /let trayIconFingerprint = null;/);
  assert.match(appSource, /function trayIconSignature\(mode\)/);
  assert.match(
    appSource,
    /if \(signature === trayIconFingerprint\) return;/,
    'an unchanged signature should skip the rasterization'
  );
  assert.match(
    appSource,
    /if \(state\.settings\?\.showTrayIcon === false\) return;/,
    'a hidden tray icon needs no bitmap'
  );
  // The signature must include the provider data the limit-bar modes draw from.
  const signatureBody = appSource.slice(
    appSource.indexOf('function trayIconSignature(mode)'),
    appSource.indexOf('function maybeUpdateBarsIcon(')
  );
  assert.match(signatureBody, /limits\.providers/, 'provider windows drive the bar heights');
  assert.match(signatureBody, /configuredLimitProviderOrder\(\)/, 'provider order is user-configurable');
  assert.match(signatureBody, /trayCustomLayout/, 'a custom layout changes the bitmap');
});

test('collapsed panels leave the tab order and controls keep a focus ring', () => {
  const styles = readRenderer('styles.css');
  // opacity:0 with zero height still kept the collapsed settings panel focusable,
  // so keyboard users tabbed through hundreds of invisible controls.
  const panelRule = styles.match(/\.settings-panel\.hidden \{([^}]*)\}/);
  assert.ok(panelRule, '.settings-panel.hidden should exist');
  assert.match(panelRule[1], /visibility:\s*hidden/, 'a collapsed panel must leave the tab order');
  const accordionRule = styles.match(/\.accordion-animated-container\.hidden \{([^}]*)\}/);
  assert.ok(accordionRule, '.accordion-animated-container.hidden should exist');
  assert.match(accordionRule[1], /visibility:\s*hidden/);

  // The blanket `button:focus { outline: none }` removed the only affordance and
  // nothing restored it for the titlebar/tab/refresh controls.
  assert.doesNotMatch(styles, /button:focus,\s*button:focus-visible\s*\{\s*outline:\s*none/);
  assert.match(styles, /button:focus:not\(:focus-visible\)/);
  for (const selector of ['.icon-button:focus-visible', '.tab:focus-visible', '.refresh-button:focus-visible']) {
    assert.ok(styles.includes(selector), `${selector} should define a visible ring`);
  }
  // Range inputs had their border zeroed, so they need an outline rather than a
  // border-colour change.
  assert.match(styles, /input\[type="range"\]:focus-visible/);
});
