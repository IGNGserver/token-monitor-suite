'use strict';

// Upgrade compatibility.
//
// The rewrite must not cost an existing install its configuration: the user
// asked for a lossless migration, and AGENTS.md treats settings keys as a
// compatibility surface. These tests pin both halves of that promise — retained
// keys survive, and widget-era keys are dropped rather than left behind looking
// like they still do something.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const main = fs.readFileSync(path.join(root, 'src', 'electron', 'main.js'), 'utf8');

// Keys the plan retains as device-local. Each must still exist in
// defaultSettings(), or an upgraded profile would lose it on the next write.
const RETAINED_KEYS = [
  'hubMode', 'hubUrl', 'secret', 'allowInsecureHubHttp', 'deviceId',
  'clients', 'projectsEnabled', 'historyEnabled', 'historyIntervalMs',
  'sessionUsageArchiveEnabled', 'wslScanEnabled', 'allTimeSince',
  'collectionMode', 'collectionIntervalMs', 'watchEnabled', 'watchDebounceMs',
  'exportAutoEnabled', 'exportDir', 'exportIntervalMs',
  'customModelPricing', 'refreshMs',
  'glassOpacity', 'glassBlur', 'systemGlass', 'macosGlassStyle', 'windowsBackdrop',
  'reduceMotion', 'showLiveDot', 'showToolIcons', 'titleIconOnly',
  'showCompactTotalTokens', 'zoomFactor', 'heatmapMetric', 'homeActiveDaysWindow',
  'themeColors', 'vendorColors',
  'clientDisplayOrder', 'hiddenClients', 'pinnedClients',
  'viewDisplayOrder', 'hiddenViews', 'homeModuleOrder', 'hiddenHomeModules',
  'homeLimitProviderOrder', 'hiddenHomeLimitProviders', 'homeLimitAccountCount',
  'showHomeLimitBars', 'showHomeLimitProviderNames', 'limitProviderOrder',
  'serviceProviderDisplayOrder', 'hiddenServiceProviders', 'serviceStatusRefreshMs',
  'showLimitSource', 'maskLimitAccountEmails', 'showLimitUsed',
  'startAtLogin', 'automaticAppUpdates', 'appUpdate', 'discordRpcEnabled',
  'language', 'currency', 'currencyRates',
  'windowBounds', 'lastViewState', 'archivedClientUsage', 'migratedDefaultClients',
  'lastPostedDeviceId'
];

// Widget-only keys that must NOT survive: nothing reads them now.
const DROPPED_KEYS = [
  'windowBehavior', 'alwaysOnTop', 'floatingBubbleEnabled', 'floatingBubbleTrigger',
  'floatingBubbleContent', 'floatingBubbleCustomLayout', 'floatingBubbleBounds',
  'showTrayIcon', 'trayMode', 'closeToTray', 'startInTray', 'trayContent',
  'trayCustomLayout', 'showTrayProviderBadge', 'windowToggleShortcut',
  'limitsEnabled', 'limitProviders'
];

function defaultSettingsBlock() {
  const start = main.indexOf('function defaultSettings()');
  assert.ok(start >= 0, 'defaultSettings should exist');
  return main.slice(start, main.indexOf('function normalizeCollectionMode', start));
}

test('every retained device-local setting still has a default', () => {
  const block = defaultSettingsBlock();
  // A key may be declared as `key: value` or as object shorthand (`key,`).
  const declared = (key) => new RegExp(`^\\s{4}${key}(?::|,)`, 'm').test(block);
  const missing = RETAINED_KEYS.filter((key) => !declared(key));
  assert.deepEqual(missing, [], `retained settings dropped from defaultSettings(): ${missing.join(', ')}`);
});

test('widget-only settings are not declared and are stripped on read', () => {
  const block = defaultSettingsBlock();
  const stillDeclared = DROPPED_KEYS.filter((key) => new RegExp(`^\\s{4}${key}(?::|,)`, 'm').test(block));
  assert.deepEqual(stillDeclared, [], `widget settings must not be declared: ${stillDeclared.join(', ')}`);

  // And an upgraded profile's stored values must be removed rather than ignored,
  // so settings.json stops implying the keys still work.
  // Slice from the comment that introduces the strip list to the call that ends
  // it, using the *last* index so an earlier function definition does not bound it.
  const stripStart = main.indexOf('Widget-era keys are dropped');
  const stripEnd = main.indexOf('invalidateLegacyLocalLimitData()', stripStart);
  assert.ok(stripStart > 0 && stripEnd > stripStart, 'the widget-key strip block should be present');
  const stripBlock = main.slice(stripStart, stripEnd);
  const unstripped = DROPPED_KEYS.filter((key) => !stripBlock.includes(`'${key}'`));
  assert.deepEqual(unstripped, [], `widget keys not stripped on read: ${unstripped.join(', ')}`);
});

test('legacy widget settings keys are invalidated like other removed credentials', () => {
  // The device-local quota keys were already stripped before this rewrite; the
  // rewrite must not have removed that cleanup.
  assert.match(main, /LEGACY_LOCAL_LIMIT_SETTING_KEYS/, 'legacy local limit keys must still be stripped');
  assert.match(main, /stripLegacyLocalLimitSettings/, 'the strip helper must still be applied');
});

test('saved view preferences migrate onto the shared view set', () => {
  // The widget had nine breakdown-shaped view ids; the shared UI has eight
  // pages. A saved order/hidden set must translate, not vanish.
  const mapping = main.slice(main.indexOf('const LEGACY_TO_SHARED_VIEW'), main.indexOf('const SHARED_VIEW_LIST'));
  for (const [legacy, shared] of [
    ['home', 'overview'],
    ['tool', 'usage'],
    ['model', 'usage'],
    ['project', 'usage'],
    ['session', 'usage'],
    ['status', 'limits'],
    ['device', 'devices'],
    ['limits', 'limits'],
    ['trends', 'trends']
  ]) {
    assert.match(mapping, new RegExp(`${legacy}:\\s*'${shared}'`), `${legacy} should map to ${shared}`);
  }
  // The migration is wired into the read path.
  assert.match(main, /migrateHiddenViewsToShared\(/, 'hidden views must migrate on read');
  assert.match(main, /migrateViewOrderToShared\(/, 'view order must migrate on read');
});

test('credentials keep their existing shape', () => {
  // secret lives in credentials.json, not settings.json; the rewrite must not
  // have moved it, or every existing install would need re-authenticating.
  const credentialStore = fs.readFileSync(path.join(root, 'src', 'shared', 'credentialStore.js'), 'utf8');
  assert.match(credentialStore, /CREDENTIAL_SETTING_PATHS/, 'the credential path map must still exist');
  assert.match(credentialStore, /clientSecret/, 'the Hub secret path must be unchanged');
  assert.match(main, /stripCredentialSettings|credentialSettingsForRenderer/, 'settings.json must still be written without credentials');
});
