'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const SHARED_I18N = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'shared-ui', 'core', 'i18n.js'), 'utf8');

function desktopSettingsSource() {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'shared-ui', 'views', 'settingsDesktop.js'), 'utf8');
}

test('the startup setting explains the AppImage caveat on Linux', () => {
  const source = desktopSettingsSource();
  // Autostart points at the AppImage's current path; moving it breaks the entry.
  assert.match(source, /desktop\.settings\.startAtLoginNote/, 'Linux should get the AppImage-specific note');
  assert.match(source, /info\.platform === 'linux'/, 'the AppImage note must be gated on the linux platform');
  assert.match(source, /desktop\.settings\.startAtLoginUnavailable/, 'unsupported builds keep the availability note');
});

test('the AppImage caveat is translated and mentions moving the file', () => {
  assert.match(SHARED_I18N, /'desktop\.settings\.startAtLoginNote': '[^']*AppImage/);
  assert.match(SHARED_I18N, /'desktop\.settings\.startAtLoginNote': '[^']*(?:mov|renam)/i);
});

test('the availability note no longer claims macOS/Windows only', () => {
  assert.doesNotMatch(SHARED_I18N, /'desktop\.settings\.startAtLoginUnavailable': '[^']*macOS and Windows/);
  assert.match(SHARED_I18N, /'desktop\.settings\.startAtLoginUnavailable': '[^']*AppImage/);
});
