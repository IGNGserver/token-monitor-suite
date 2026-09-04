'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMacWidgetDeepLink } = require('../../src/electron/macWidgetDeepLink');

test('macOS Widget links map only allowlisted pages into renderer views', () => {
  assert.deepEqual(parseMacWidgetDeepLink('token-monitor://overview'), { page: 'overview', view: 'home', settings: false });
  assert.deepEqual(parseMacWidgetDeepLink('token-monitor://quota'), { page: 'quota', view: 'limits', settings: false });
  assert.deepEqual(parseMacWidgetDeepLink('token-monitor://models'), { page: 'models', view: 'model', settings: false });
  assert.deepEqual(parseMacWidgetDeepLink('token-monitor://widget-settings'), { page: 'overview', view: 'home', settings: true });
  assert.equal(parseMacWidgetDeepLink('https://overview'), null);
  assert.equal(parseMacWidgetDeepLink('token-monitor://unknown'), null);
});
