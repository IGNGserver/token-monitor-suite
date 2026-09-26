'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { validatePackageJsonIdentity, verifyIntegrity } = require('../../src/shared/tokscaleUpdater');

test('normal updater startup does not load the tar archive parser', () => {
  const script = "require('./src/shared/tokscaleUpdater'); process.stdout.write(String(Object.keys(require.cache).some((file) => /(?:^|\\/)tar(?:\\/|$)/.test(file))))";
  const loaded = execFileSync(process.execPath, ['-e', script], {
    cwd: require('node:path').join(__dirname, '../..'),
    encoding: 'utf8'
  });
  assert.equal(loaded, 'false');
});

test('verifyIntegrity validates npm SRI sha512 strings', () => {
  const body = Buffer.from('tokscale tarball');
  const digest = crypto.createHash('sha512').update(body).digest('base64');

  assert.equal(verifyIntegrity(body, `sha512-${digest}`), true);
  assert.equal(verifyIntegrity(Buffer.from('changed'), `sha512-${digest}`), false);
});

test('verifyIntegrity rejects unsupported or malformed integrity strings', () => {
  const body = Buffer.from('tokscale tarball');
  const digest = crypto.createHash('sha256').update(body).digest('base64');

  assert.equal(verifyIntegrity(body, `sha256-${digest}`), false);
  assert.equal(verifyIntegrity(body, 'not-sri'), false);
});

test('validatePackageJsonIdentity accepts matching package metadata', () => {
  assert.doesNotThrow(() => validatePackageJsonIdentity({
    name: '@tokscale/cli-darwin-arm64',
    version: '2.3.0',
    os: ['darwin'],
    cpu: ['arm64']
  }, {
    packageName: '@tokscale/cli-darwin-arm64',
    version: '2.3.0',
    platform: 'darwin',
    arch: 'arm64'
  }));
});

test('validatePackageJsonIdentity rejects package, version, os, or cpu mismatches', () => {
  const expected = {
    packageName: '@tokscale/cli-darwin-arm64',
    version: '2.3.0',
    platform: 'darwin',
    arch: 'arm64'
  };

  assert.throws(() => validatePackageJsonIdentity({ name: 'tokscale', version: '2.3.0' }, expected), /package name/i);
  assert.throws(() => validatePackageJsonIdentity({ name: expected.packageName, version: '2.2.0' }, expected), /package version/i);
  assert.throws(() => validatePackageJsonIdentity({ name: expected.packageName, version: expected.version, os: ['linux'] }, expected), /package os/i);
  assert.throws(() => validatePackageJsonIdentity({ name: expected.packageName, version: expected.version, cpu: ['x64'] }, expected), /package cpu/i);
});
