'use strict';

// AppImage is the only Linux target electron-updater can install in place. A real
// build produced a latest-linux.yml whose top-level `path` (and only `files`
// entry) was the .deb, which silently breaks auto-update for every AppImage
// install. These tests pin the feed contract so that cannot ship again.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  verifyLinuxAppImageUpdaterFeed,
  verifyUpdaterArtifactNames
} = require('../../scripts/verify-updater-artifact-names');

const APPIMAGE = 'Token-Monitor-0.45.0-rev.40.AppImage';
const DEB = 'Token-Monitor-0.45.0-rev.40.deb';

function makeDist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-feed-'));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

function linuxFeed({ files, primary, withArtifacts = true }) {
  const list = files.map((name) => [
    `  - url: ${name}`,
    `    sha512: ${'A'.repeat(88)}==`,
    '    size: 100'
  ].join('\n')).join('\n');
  return {
    'latest-linux.yml': `version: 0.45.0-rev.40\nfiles:\n${list}\npath: ${primary}\nsha512: ${'A'.repeat(88)}==\n`,
    ...(withArtifacts ? Object.fromEntries(files.map((name) => [name, 'artifact'])) : {})
  };
}

test('accepts a feed that lists both targets with the AppImage as path', () => {
  const dir = makeDist(linuxFeed({ files: [APPIMAGE, DEB], primary: APPIMAGE }));
  const result = verifyLinuxAppImageUpdaterFeed(dir);
  assert.equal(result.primary, APPIMAGE);
  assert.deepEqual(result.appImages, [APPIMAGE]);
  assert.doesNotThrow(() => verifyUpdaterArtifactNames(dir));
});

test('rejects the historical deb-only feed', () => {
  const dir = makeDist(linuxFeed({ files: [DEB], primary: DEB }));
  assert.throws(
    () => verifyLinuxAppImageUpdaterFeed(dir),
    new RegExp(`path is ${DEB.replace(/\./g, '\\.')}.*AppImage`, 's')
  );
});

test('rejects a feed whose files list has no AppImage', () => {
  const dir = makeDist(linuxFeed({ files: [DEB], primary: DEB }));
  assert.throws(() => verifyLinuxAppImageUpdaterFeed(dir), /AppImage/);
});

test('rejects a feed referencing an AppImage that is not on disk', () => {
  const dir = makeDist(linuxFeed({ files: [APPIMAGE, DEB], primary: APPIMAGE, withArtifacts: false }));
  assert.throws(
    () => verifyUpdaterArtifactNames(dir),
    /references missing artifacts/
  );
});

test('is a no-op when the linux feed is not part of the build', () => {
  const dir = makeDist({
    'latest.yml': 'version: 0.45.0-rev.40\nfiles:\n  - url: Token-Monitor-Setup-0.45.0-rev.40.exe\n    sha512: x\npath: Token-Monitor-Setup-0.45.0-rev.40.exe\n',
    'Token-Monitor-Setup-0.45.0-rev.40.exe': 'installer'
  });
  assert.deepEqual(verifyLinuxAppImageUpdaterFeed(dir), { skipped: true });
});

test('flags the historical deb-only feed shape as broken', () => {
  // Reproduces the exact shape found in dist/latest-linux.yml before the fix:
  // a top-level path and a single files entry, both the .deb. The verifier must
  // reject it rather than let it reach a release.
  const dir = makeDist(linuxFeed({ files: [DEB], primary: DEB }));
  assert.throws(
    () => verifyLinuxAppImageUpdaterFeed(dir),
    /AppImage installs need path to be the \.AppImage/
  );
});
