'use strict';

// The desktop settings surface is where the rewrite's compatibility promise is
// kept: every key a user could configure in the old widget must still be
// reachable here. These tests pin the mapping from form field to settings key,
// because a renamed `name` attribute would silently stop persisting a choice.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { installDom } = require('../helpers/domShim');

const viewPath = path.join(__dirname, '..', '..', 'src', 'shared-ui', 'views', 'settingsDesktop.js');

// The module is browser ESM; evaluate it with its import graph stubbed so the
// test stays a pure unit test of the field mapping.
function loadView() {
  installDom(globalThis);
  const source = fs.readFileSync(viewPath, 'utf8')
    .replace(/^import \{[\s\S]*?\} from '\.\.\/core\/viewContext\.js';/m, `
      const tr = (key) => key;
      const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
      const settingsOptionList = (options, selected) => options
        .map(([value, label]) => \`<option value="\${value}"\${String(value) === String(selected) ? ' selected' : ''}>\${label}</option>\`)
        .join('');
    `);
  const factory = new Function(`${source.replace(/^export /gm, '')}
    return { renderDesktopSettings, readDesktopSettingsPatch };`);
  return factory();
}

test('every retained settings key has a form control', () => {
  const { renderDesktopSettings } = loadView();
  const html = renderDesktopSettings({
    clients: 'claude', collectionMode: 'live', collectionIntervalMs: 300000,
    historyIntervalMs: 900000, exportIntervalMs: 60000, zoomFactor: 1,
    syncUploadIntervalMs: 600000, deviceId: 'box', allTimeSince: '2024-01-01',
    hubUrl: '', hubMode: 'local'
  }, { clients: ['claude', 'codex'], collectionIntervals: [] }, { platform: 'linux', loginItemSupported: true });

  // The settings keys the plan retains as device-local must each appear.
  const required = [
    'collectionMode', 'collectionIntervalMs', 'projectsEnabled',
    'historyEnabled', 'historyIntervalMs', 'sessionUsageArchiveEnabled',
    'allTimeSince', 'exportAutoEnabled', 'exportIntervalMs', 'systemGlass',
    'reduceMotion', 'showToolIcons', 'showLiveDot', 'showCompactTotalTokens',
    'zoomFactor', 'startAtLogin', 'automaticAppUpdates', 'discordRpcEnabled',
    'deviceId', 'hubMode', 'hubUrl', 'syncUploadIntervalMs', 'allowInsecureHubHttp'
  ];
  const missing = required.filter((key) => !html.includes(`name="${key}"`));
  assert.deepEqual(missing, [], `settings with no control: ${missing.join(', ')}`);
  // The tracked-client checklist is a set of ids rather than one named field.
  assert.ok(html.includes('data-token-list="clients"'), 'tracked tools need a checklist control');
});

test('WSL scanning is offered only on Windows', () => {
  const { renderDesktopSettings } = loadView();
  const win = renderDesktopSettings({}, { clients: [] }, { platform: 'win32' });
  const linux = renderDesktopSettings({}, { clients: [] }, { platform: 'linux' });
  assert.ok(win.includes('name="wslScanEnabled"'), 'Windows needs the WSL toggle');
  assert.ok(!linux.includes('name="wslScanEnabled"'), 'WSL scanning is meaningless off Windows');
});

test('the macOS glass selector is macOS-only', () => {
  const { renderDesktopSettings } = loadView();
  assert.ok(renderDesktopSettings({}, { clients: [] }, { platform: 'darwin' }).includes('macosGlassStyle'));
  assert.ok(!renderDesktopSettings({}, { clients: [] }, { platform: 'win32' }).includes('macosGlassStyle'));
});

test('start at login is hidden when the platform has no login item', () => {
  const { renderDesktopSettings } = loadView();
  const unsupported = renderDesktopSettings({}, { clients: [] }, { platform: 'linux', loginItemSupported: false });
  assert.ok(!unsupported.includes('name="startAtLogin"'), 'a control that cannot work must not be offered');
});

test('reading the form back produces the right value types', () => {
  const { renderDesktopSettings, readDesktopSettingsPatch } = loadView();
  // The DOM shim does not parse HTML, so stand in a form whose query methods
  // return the fields the reader looks for.
  const html = renderDesktopSettings({ clients: 'claude', deviceId: 'box' }, { clients: ['claude', 'codex'] }, { platform: 'linux' });
  assert.ok(html.length > 0);

  const fields = [
    ['projectsEnabled', 'checkbox', true], ['historyEnabled', 'checkbox', false],
    ['collectionIntervalMs', 'number', '600000'], ['zoomFactor', 'number', '1.25'],
    ['deviceId', 'text', ' renamed '], ['collectionMode', 'select', 'smart'],
    ['hubUrl', 'text', ' http://hub:17321 ']
  ];
  const nodes = fields.map(([name, type, value]) => ({ name, type, value: String(value), checked: value === true }));
  const form = {
    querySelector(selector) {
      const m = /^\[name="([^"]+)"\]$/.exec(selector);
      if (m) return nodes.find((n) => n.name === m[1]) || null;
      return null;
    },
    querySelectorAll: () => []
  };

  const patch = readDesktopSettingsPatch(form);
  assert.equal(patch.projectsEnabled, true, 'checkboxes read as booleans');
  assert.equal(patch.historyEnabled, false);
  assert.equal(patch.collectionIntervalMs, 600000, 'numeric fields must not persist as strings');
  assert.equal(patch.zoomFactor, 1.25);
  assert.equal(patch.deviceId, 'renamed', 'text fields are trimmed');
  assert.equal(patch.hubUrl, 'http://hub:17321');
  assert.equal(patch.collectionMode, 'smart');
});

test('the tracked-client checklist round-trips as a csv', () => {
  const { renderDesktopSettings, readDesktopSettingsPatch } = loadView();
  const html = renderDesktopSettings({ clients: 'claude,codex' }, { clients: ['claude', 'codex', 'cursor'] }, { platform: 'linux' });
  // All three tools are offered, with the configured two pre-checked.
  assert.equal((html.match(/data-token-list="clients"/g) || []).length, 3);
  assert.equal((html.match(/data-token-list="clients"[^>]*checked/g) || []).length, 2);

  const form = { querySelector: () => ({}), querySelectorAll: () => [{ value: 'claude' }, { value: 'cursor' }] };
  assert.equal(readDesktopSettingsPatch(form).clients, 'claude,cursor');
});
