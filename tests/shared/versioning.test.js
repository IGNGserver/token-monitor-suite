'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  compareProjectVersions,
  isProjectVersion,
  parseProjectTag,
  parseProjectVersion
} = require('../../src/shared/versioning');
const { verifyReleaseVersion } = require('../../scripts/verify-release-version');

test('project versions use an upstream SemVer plus a positive revision', () => {
  assert.deepEqual(parseProjectVersion('0.37.23-rev.12'), {
    version: '0.37.23-rev.12',
    upstreamVersion: '0.37.23',
    channel: 'rev',
    major: 0,
    minor: 37,
    patch: 23,
    revision: 12
  });
  assert.deepEqual(parseProjectTag('v0.37.23-rev.12'), parseProjectVersion('0.37.23-rev.12'));
  assert.equal(isProjectVersion('0.37.23-rev.1'), true);
});

test('project version validation rejects a fourth core component and unrelated prerelease channels', () => {
  for (const version of [
    '0.37.23',
    '0.37.23.1',
    '0.37.23-beta.1',
    '0.37.23-rev.0',
    '0.37.23-rev.01',
    'v0.37.23-rev.1'
  ]) {
    assert.equal(parseProjectVersion(version), null, version);
  }
});

test('project versions compare upstream components before local revisions', () => {
  assert.equal(compareProjectVersions('0.37.23-rev.2', '0.37.23-rev.1'), 1);
  assert.equal(compareProjectVersions('0.37.24-rev.1', '0.37.23-rev.99'), 1);
  assert.equal(compareProjectVersions('0.37.23-rev.1', '0.37.23-rev.1'), 0);
  assert.equal(compareProjectVersions('0.37.23-rev.1', '0.37.23-rev.2'), -1);
});

test('release version verification checks the synchronized package metadata', () => {
  assert.equal(verifyReleaseVersion('v0.45.0-rev.16'), '0.45.0-rev.16');
  assert.throws(() => verifyReleaseVersion('0.37.23'), /Invalid project release version/);
});
