'use strict';

// The desktop settings surface is deliberately small: 显示 / 行为 / 连接.
// These tests pin the mapping from form field to settings key, because a
// renamed `name` attribute would silently stop persisting a choice. They also
// pin the window-material folding: the single dropdown stores the legacy
// (systemGlass, windowsBackdrop) pair the window code reads.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { installDom } = require('../helpers/domShim');

const viewPath = path.join(__dirname, '..', '..', 'src', 'shared-ui', 'views', 'settingsDesktop.js');

// The module is browser ESM; evaluate it with its import graph stubbed so the
// test stays a pure unit test of the field mapping.
function loadView(state = {}) {
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
      // The update panel renders only what the main process pushed,
      // so the stub reports whatever the test provides.
      const appState = () => (${JSON.stringify({
    desktopAppUpdate: null, ...state
  })});
    `);
  const factory = new Function(`${source.replace(/^export /gm, '')}
    return { renderDesktopSettings, readDesktopSettingsPatch, desktopSettingsFieldError, surfaceValueFromSettings, settingsPatchForSurface };`);
  return factory();
}

test('the three groups render and no legacy group remains', () => {
  const { renderDesktopSettings } = loadView();
  const html = renderDesktopSettings({ hubMode: 'client' }, { platform: 'win32', loginItemSupported: true });
  for (const id of ['display', 'behaviour', 'connection']) {
    assert.ok(html.includes(`data-desktop-group="${id}"`), `the ${id} group exists`);
  }
  for (const legacy of ['collection', 'engine', 'export', 'appearance', 'limitsDisplay', 'general', 'device', 'preferences', 'advanced']) {
    assert.ok(!html.includes(`data-desktop-group="${legacy}"`), `the ${legacy} group is gone`);
  }
});

test('every retained settings key has a form control', () => {
  const { renderDesktopSettings } = loadView();
  const html = renderDesktopSettings({
    hubUrl: '', hubMode: 'client', deviceId: 'box'
  }, { platform: 'win32', loginItemSupported: true });

  const required = [
    'language', 'windowSurface', 'reduceMotion',
    'startAtLogin', 'startHidden', 'closeToTray',
    'hubMode', 'hubUrl', 'allowInsecureHubHttp', 'deviceId'
  ];
  const missing = required.filter((key) => !html.includes(`name="${key}"`));
  assert.deepEqual(missing, [], `settings with no control: ${missing.join(', ')}`);
  assert.ok(html.includes('data-desktop-action="check-updates"'), 'a check-for-updates button exists');
  assert.ok(html.includes('data-desktop-action="download-install-update"'), 'an install button exists');
});

test('hub-owned fields are offered only in hub mode', () => {
  const { renderDesktopSettings } = loadView();
  const client = renderDesktopSettings({ hubMode: 'client' }, { platform: 'linux', loginItemSupported: true });
  for (const key of ['hubUrl', 'allowInsecureHubHttp', 'deviceId']) {
    assert.ok(client.includes(`name="${key}"`), `${key} appears in hub mode`);
  }
  const local = renderDesktopSettings({ hubMode: 'local' }, { platform: 'linux', loginItemSupported: true });
  for (const key of ['hubUrl', 'allowInsecureHubHttp', 'deviceId']) {
    assert.ok(!local.includes(`name="${key}"`), `${key} is hidden in local mode`);
  }
  assert.ok(local.includes('name="hubMode"'), 'the mode toggle itself always shows');
});

test('the window material folds into the legacy (systemGlass, windowsBackdrop) pair', () => {
  const { settingsPatchForSurface, surfaceValueFromSettings } = loadView();
  assert.deepEqual(settingsPatchForSurface('regular'), { systemGlass: false });
  assert.deepEqual(settingsPatchForSurface('transparent'), { systemGlass: true });
  assert.deepEqual(settingsPatchForSurface('acrylic'), { systemGlass: true, windowsBackdrop: 'acrylic' });
  assert.deepEqual(settingsPatchForSurface('mica'), { systemGlass: true, windowsBackdrop: 'mica' });

  assert.equal(surfaceValueFromSettings({ systemGlass: false }, { platform: 'win32' }), 'regular');
  assert.equal(surfaceValueFromSettings({ systemGlass: true, windowsBackdrop: 'mica' }, { platform: 'win32' }), 'mica');
  assert.equal(surfaceValueFromSettings({ systemGlass: true, windowsBackdrop: 'acrylic' }, { platform: 'win32' }), 'acrylic');
  assert.equal(surfaceValueFromSettings({ systemGlass: true, windowsBackdrop: 'mica' }, { platform: 'darwin' }), 'transparent',
    'a material another platform cannot apply reads as plain transparency');
});

test('acrylic and mica are offered only on Windows', () => {
  const { renderDesktopSettings } = loadView();
  const win = renderDesktopSettings({}, { platform: 'win32' });
  assert.ok(win.includes('value="acrylic"'), 'Windows offers acrylic');
  assert.ok(win.includes('value="mica"'), 'Windows offers mica');
  for (const platform of ['darwin', 'linux']) {
    const html = renderDesktopSettings({}, { platform });
    assert.ok(!html.includes('value="acrylic"'), `${platform} does not offer acrylic`);
    assert.ok(!html.includes('value="mica"'), `${platform} does not offer mica`);
  }
});

test('start at login is hidden when the platform has no login item', () => {
  const { renderDesktopSettings } = loadView();
  const unsupported = renderDesktopSettings({}, { platform: 'linux', loginItemSupported: false });
  assert.ok(!unsupported.includes('name="startAtLogin"'), 'a control that cannot work must not be offered');
  assert.ok(!unsupported.includes('name="startHidden"'), 'silent start presupposes a login item');
});

test('reading the form back produces the right value types', () => {
  const { renderDesktopSettings, readDesktopSettingsPatch } = loadView();
  const html = renderDesktopSettings({ hubMode: 'client', deviceId: 'box' }, { platform: 'linux', loginItemSupported: true });
  assert.ok(html.length > 0);

  const fields = [
    ['startAtLogin', 'checkbox', true], ['closeToTray', 'checkbox', false],
    ['deviceId', 'text', ' renamed '], ['hubUrl', 'text', ' http://hub:17321 ']
  ];
  const nodes = fields.map(([name, type, value]) => ({ name, type, value: String(value), checked: value === true }));
  const form = {
    querySelector(selector) {
      if (selector === '[name="windowSurface"]') return { value: 'regular' };
      if (selector === '[name="language"]') return { value: 'zh-CN' };
      if (selector === '[name="reduceMotion"]') return { value: 'on' };
      if (selector === 'fluent-radio-group[name="hubMode"]') return { value: 'client' };
      const m = /^\[name="([^"]+)"\]$/.exec(selector);
      if (m) return nodes.find((n) => n.name === m[1]) || null;
      return null;
    },
    querySelectorAll: () => []
  };

  const patch = readDesktopSettingsPatch(form);
  assert.equal(patch.startAtLogin, true, 'checkboxes read as booleans');
  assert.equal(patch.closeToTray, false);
  assert.equal(patch.deviceId, 'renamed', 'text fields are trimmed');
  assert.equal(patch.hubUrl, 'http://hub:17321');
  assert.equal(patch.hubMode, 'client');
  assert.equal(patch.language, 'zh-CN');
  assert.equal(patch.reduceMotion, 'on');
  assert.equal(patch.systemGlass, false, 'the surface control unfolds to the legacy pair');
  assert.equal(patch.windowsBackdrop, undefined, 'regular carries no material');
});

test('the surface control round-trips through the dropdown', () => {
  const { readDesktopSettingsPatch } = loadView();
  const formFor = (value) => ({
    querySelector: (selector) => (selector === '[name="windowSurface"]' ? { value } : null),
    querySelectorAll: () => []
  });
  assert.equal(readDesktopSettingsPatch(formFor('mica')).windowsBackdrop, 'mica');
  assert.equal(readDesktopSettingsPatch(formFor('mica')).systemGlass, true);
  assert.equal(readDesktopSettingsPatch(formFor('regular')).systemGlass, false);
});

test('the update controls are always reachable; the reason text explains a blocked install', () => {
  const { renderDesktopSettings } = loadView({
    desktopAppUpdate: {
      currentVersion: '1.0.0', latest: { version: '1.1.0' }, hasUpdate: true,
      downloaded: false, installSupported: true
    }
  });
  const html = renderDesktopSettings({}, { platform: 'win32' });
  assert.match(html, /data-desktop-action="check-updates"/);
  assert.match(html, /data-desktop-action="download-install-update"/);

  const unsupported = loadView({
    desktopAppUpdate: {
      currentVersion: '1.0.0', latest: { version: '1.1.0' }, hasUpdate: true,
      downloaded: true, installSupported: false, installSupportReason: 'portable build'
    }
  }).renderDesktopSettings({}, { platform: 'linux' });
  assert.match(unsupported, /data-desktop-action="download-install-update"/, 'the install button stays reachable');
  assert.match(unsupported, /portable build/, 'the reason is shown rather than the button hidden silently');
});
