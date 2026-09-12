'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeReleaseDate,
  prepareLinuxPackageMetadata
} = require('../../scripts/prepare-linux-package-metadata');
const {
  parseArgs: parseAptArgs,
  renderReleaseFile
} = require('../../scripts/build-apt-repository');

test('Linux AppStream metadata renders the package version and release date', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-metainfo-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const templatePath = path.join(directory, 'template.xml');
  const outputPath = path.join(directory, 'nested', 'token-monitor.metainfo.xml');
  fs.writeFileSync(templatePath, '<component><release version="__VERSION__" date="__RELEASE_DATE__" /></component>\n');

  const result = prepareLinuxPackageMetadata({
    version: '0.45.0-rev.28',
    releaseDate: '2026-09-12',
    templatePath,
    outputPath
  });

  assert.equal(result, outputPath);
  assert.equal(
    fs.readFileSync(outputPath, 'utf8'),
    '<component><release version="0.45.0-rev.28" date="2026-09-12" /></component>\n'
  );
});

test('Linux AppStream template declares an App Center launchable', () => {
  const templatePath = path.join(__dirname, '..', '..', 'packaging', 'linux', 'token-monitor.metainfo.xml.in');
  const template = fs.readFileSync(templatePath, 'utf8');
  assert.match(template, /<id>com\.javis\.tokenmonitor\.desktop<\/id>/);
  assert.match(template, /<launchable type="desktop-id">token-monitor\.desktop<\/launchable>/);
  assert.match(template, /<category>Development<\/category>/);
  assert.match(template, /<provides>\s*<binary>token-monitor<\/binary>/);
});

test('Linux package metadata rejects malformed release dates', () => {
  assert.equal(normalizeReleaseDate('2026-09-12'), '2026-09-12');
  assert.throws(() => normalizeReleaseDate('2026/09/12'), /YYYY-MM-DD/);
});

test('APT repository arguments keep signature requirements explicit', () => {
  assert.deepEqual(
    parseAptArgs([
      '--input-dir', 'dist',
      '--output-dir', 'apt',
      '--suite', 'preview',
      '--signing-key', 'release@example.com',
      '--require-signature'
    ]),
    {
      inputDir: 'dist',
      outputDir: 'apt',
      suite: 'preview',
      component: 'main',
      architecture: 'amd64',
      signingKey: 'release@example.com',
      requireSignature: true,
      releaseDate: new Date().toISOString().slice(0, 10)
    }
  );
});

test('APT Release metadata lists checksums for compressed indexes', () => {
  const release = renderReleaseFile({
    suite: 'stable',
    component: 'main',
    architecture: 'amd64',
    releaseDate: '2026-09-12',
    files: [
      {
        relativePath: 'main/binary-amd64/Packages',
        size: 12,
        md5: 'md5sum',
        sha256: 'sha256sum'
      }
    ]
  });
  assert.match(release, /Suite: stable/);
  assert.match(release, /Architectures: amd64/);
  assert.match(release, / md5sum 12 main\/binary-amd64\/Packages/);
  assert.match(release, / sha256sum 12 main\/binary-amd64\/Packages/);
});

test('Linux release workflow verifies the built Debian package', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', 'release.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /name: Verify Debian package metadata and version/);
  assert.match(workflow, /npm run verify:deb -- "\$deb_path" --version "\$version"/);
  assert.match(workflow, /name: Build signed APT repository/);
  assert.match(workflow, /--require-signature/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
});

test('APT source configuration uses a local keyring and the stable suite', () => {
  const sourcePath = path.join(__dirname, '..', '..', 'packaging', 'linux', 'token-monitor.sources');
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.match(source, /URIs: https:\/\/igngserver\.github\.io\/token-monitor-suite\/apt/);
  assert.match(source, /Suites: stable/);
  assert.match(source, /Signed-By: \/usr\/share\/keyrings\/token-monitor-archive-keyring\.gpg/);
  assert.doesNotMatch(source, /trusted=yes/);
});

test('Pages workflow preserves the APT repository when the site is rebuilt', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', 'pages.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /releases\/latest/);
  assert.match(workflow, /gh release download "\$latest_tag" --pattern '\*\.deb'/);
  assert.match(workflow, /--require-signature/);
  assert.match(workflow, /refusing to deploy a Pages site that would erase the APT repository/);
});
