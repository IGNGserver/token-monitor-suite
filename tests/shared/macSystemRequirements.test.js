'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAC_APP_MIN_DARWIN_VERSION,
  MAC_APP_MIN_VERSION
} = require('../../src/shared/macSystemRequirements');

test('keeps the app floor and its Darwin equivalent aligned', () => {
  assert.equal(MAC_APP_MIN_VERSION, '12.0');
  assert.equal(MAC_APP_MIN_DARWIN_VERSION, '21.0.0');
});

test('the Darwin floor is the macOS release the marketing version names', () => {
  // electron-builder writes MAC_APP_MIN_VERSION into LSMinimumSystemVersion while
  // electron-updater compares against os.release(); if one is bumped without the
  // other, an installer would advertise a floor the updater never enforces.
  const major = Number(MAC_APP_MIN_DARWIN_VERSION.split('.')[0]);
  assert.equal(Number(MAC_APP_MIN_VERSION.split('.')[0]) + 9, major);
});
