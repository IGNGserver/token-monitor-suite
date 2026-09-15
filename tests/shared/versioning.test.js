'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const packageJson = require('../../package.json');

const {
  compareProjectVersions,
  isProjectVersion,
  parseProjectTag,
  parseProjectVersion
} = require('../../src/shared/versioning');
const { verifyReleaseVersion } = require('../../scripts/verify-release-version');

test('project versions support standard semver as well as optional revision suffix', () => {
  assert.deepEqual(parseProjectVersion('1.0.0'), {
    version: '1.0.0',
    upstreamVersion: '1.0.0',
    channel: null,
    major: 1,
    minor: 0,
    patch: 0,
    revision: null
  });
  assert.deepEqual(parseProjectVersion('0.45.0-rev.12'), {
    version: '0.45.0-rev.12',
    upstreamVersion: '0.45.0',
    channel: 'rev',
    major: 0,
    minor: 45,
    patch: 0,
    revision: 12
  });
  assert.deepEqual(parseProjectTag('v1.0.0'), parseProjectVersion('1.0.0'));
  assert.deepEqual(parseProjectTag('v0.45.0-rev.12'), parseProjectVersion('0.45.0-rev.12'));
  assert.equal(isProjectVersion('1.0.0'), true);
  assert.equal(isProjectVersion('0.45.0-rev.1'), true);
});

test('project version validation rejects a fourth core component and invalid revision formats', () => {
  for (const version of [
    '1.0.0.1',
    '1.0.0-beta.1',
    '1.0.0-rev.0',
    '1.0.0-rev.01',
    'v1.0.0-rev.1'
  ]) {
    assert.equal(parseProjectVersion(version), null, version);
  }
});

test('project versions compare semver components and revisions correctly', () => {
  assert.equal(compareProjectVersions('1.0.1', '1.0.0'), 1);
  assert.equal(compareProjectVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareProjectVersions('0.45.0-rev.2', '0.45.0-rev.1'), 1);
  assert.equal(compareProjectVersions('0.45.1', '0.45.0-rev.99'), 1);
  assert.equal(compareProjectVersions('0.45.0-rev.1', '0.45.0-rev.1'), 0);
  assert.equal(compareProjectVersions('0.45.0-rev.1', '0.45.0-rev.2'), -1);
});

test('release version verification checks the synchronized package metadata', () => {
  assert.equal(verifyReleaseVersion(`v${packageJson.version}`), packageJson.version);
  assert.throws(() => verifyReleaseVersion('1.0.0.1'), /Invalid project release version/);
});
