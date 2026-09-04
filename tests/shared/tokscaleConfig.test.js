'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const { tokscaleConfigDir, tokscaleClientCacheDir, customPricingPath } = require('../../src/shared/tokscaleConfig');

test('TOKSCALE_CONFIG_DIR override wins verbatim on every platform', () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    assert.equal(
      tokscaleConfigDir({ platform, homeDir: '/home/u', env: { TOKSCALE_CONFIG_DIR: '/tmp/iso' } }),
      '/tmp/iso'
    );
  }
});

test('empty TOKSCALE_CONFIG_DIR is treated as unset', () => {
  assert.equal(
    tokscaleConfigDir({ platform: 'darwin', homeDir: '/Users/u', env: { TOKSCALE_CONFIG_DIR: '' } }),
    path.join('/Users/u', '.config', 'tokscale')
  );
});

test('macOS forces $HOME/.config/tokscale', () => {
  assert.equal(
    tokscaleConfigDir({ platform: 'darwin', homeDir: '/Users/u', env: {} }),
    path.join('/Users/u', '.config', 'tokscale')
  );
});

test('Windows uses %APPDATA%\\tokscale (Roaming), not .config', () => {
  assert.equal(
    tokscaleConfigDir({ platform: 'win32', homeDir: 'C:\\Users\\u', env: { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' } }),
    path.join('C:\\Users\\u\\AppData\\Roaming', 'tokscale')
  );
});

test('Windows falls back to <home>/AppData/Roaming when APPDATA unset', () => {
  assert.equal(
    tokscaleConfigDir({ platform: 'win32', homeDir: 'C:\\Users\\u', env: {} }),
    path.join('C:\\Users\\u', 'AppData', 'Roaming', 'tokscale')
  );
});

test('Linux honors absolute XDG_CONFIG_HOME', () => {
  assert.equal(
    tokscaleConfigDir({ platform: 'linux', homeDir: '/home/u', env: { XDG_CONFIG_HOME: '/xdg' } }),
    path.join('/xdg', 'tokscale')
  );
});

test('Linux ignores relative XDG_CONFIG_HOME and uses $HOME/.config', () => {
  assert.equal(
    tokscaleConfigDir({ platform: 'linux', homeDir: '/home/u', env: { XDG_CONFIG_HOME: 'relative/dir' } }),
    path.join('/home/u', '.config', 'tokscale')
  );
});

test('customPricingPath appends the filename', () => {
  assert.equal(
    customPricingPath({ platform: 'darwin', homeDir: '/Users/u', env: {} }),
    path.join('/Users/u', '.config', 'tokscale', 'custom-pricing.json')
  );
});

test('tokscaleClientCacheDir follows the platform-specific Tokscale config root', () => {
  assert.equal(
    tokscaleClientCacheDir('antigravity', {
      platform: 'win32',
      homeDir: 'C:\\Users\\u',
      env: { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }
    }),
    path.join('C:\\Users\\u\\AppData\\Roaming', 'tokscale', 'antigravity-cache')
  );
});
