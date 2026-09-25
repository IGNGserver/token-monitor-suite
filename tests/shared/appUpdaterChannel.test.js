'use strict';

// The update channel is decided by what is installed, not by a setting: a formal
// release must never be moved onto a `-rev.N` prerelease, while a prerelease build
// follows the newest publish. Both the GitHub release-list check and electron-updater's
// own feed go through these two functions, so the rule is asserted here once.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isPrereleaseVersion,
  parseLatestReleasePayload,
  releaseMatchesInstalledChannel
} = require('../../src/shared/appUpdater');

function releasePayload(tag, prerelease) {
  return {
    tag_name: tag,
    prerelease,
    name: tag,
    html_url: `https://github.com/IGNGserver/token-monitor-suite/releases/tag/${tag}`,
    published_at: '2026-09-25T00:00:00Z'
  };
}

test('the version scheme maps onto the release channel', () => {
  assert.equal(isPrereleaseVersion('0.47.0-rev.8'), true);
  assert.equal(isPrereleaseVersion('1.2.0'), false);
  assert.equal(isPrereleaseVersion('v1.2.0'), false);
  assert.equal(isPrereleaseVersion('not a version'), false);
});

test('the prerelease flag survives payload parsing', () => {
  // GitHub's flag is authoritative; the version suffix is the fallback so a
  // mis-marked release cannot pull a formal install onto it.
  assert.equal(parseLatestReleasePayload(releasePayload('v1.3.0-rev.2', true)).prerelease, true);
  assert.equal(parseLatestReleasePayload(releasePayload('v1.3.0', false)).prerelease, false);
  assert.equal(parseLatestReleasePayload(releasePayload('v1.4.0-rev.1', false)).prerelease, true,
    'a -rev.N tag is a prerelease even if the release was mislabelled');
});

test('a formal install only matches formal candidates', () => {
  const prerelease = { version: '1.4.0-rev.1', prerelease: true };
  const formal = { version: '1.3.0', prerelease: false };
  assert.equal(releaseMatchesInstalledChannel(prerelease, '1.2.0'), false);
  assert.equal(releaseMatchesInstalledChannel(formal, '1.2.0'), true);
});

test('a prerelease install follows the newest publish', () => {
  assert.equal(releaseMatchesInstalledChannel({ version: '1.4.0-rev.3', prerelease: true }, '1.4.0-rev.1'), true);
  assert.equal(releaseMatchesInstalledChannel({ version: '1.3.0', prerelease: false }, '1.4.0-rev.1'), true);
});
