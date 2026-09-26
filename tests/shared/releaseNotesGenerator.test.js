'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  RELEASE_ARTIFACTS,
  generateReleaseBody,
  hubDeploymentSection,
  releaseDownloadLines,
  renderReleaseBody
} = require('../../scripts/generate-release-notes');
const { extractReleaseNotes } = require('../../src/shared/appUpdater');

const root = path.join(__dirname, '..', '..');
const templatePath = path.join(root, '.github', 'RELEASE_TEMPLATE.md');
const workflowPath = path.join(root, '.github', 'workflows', 'release.yml');
const rootPackage = require('../../package.json');

const template = [
  '# Token Monitor {{tag}}',
  '',
  '## 本次更新',
  '',
  '<!-- app-update-notes:zh:start -->',
  '### 修复',
  '- 旧版本说明。',
  '<!-- app-update-notes:zh:end -->',
  '',
  '## 快捷下载',
  '',
  '<!-- release-downloads -->',
  '',
  '签名说明见 [README]({{repositoryUrl}}#readme)，包名 `Token-Monitor-{{version}}.deb`。',
  '',
  '<!-- release-hub-image -->',
  ''
].join('\n');

test('release body renders one Chinese section with version injected everywhere', () => {
  const body = renderReleaseBody(template, { version: '0.47.0', releaseType: 'prerelease' });

  assert.match(body, /^# Token Monitor v0\.47\.0$/m);
  assert.doesNotMatch(body, /旧版本说明。.*### Fixed/s);
  assert.match(body, /### 修复\n- 旧版本说明。/);
  assert.match(body, /Token-Monitor-0\.47\.0\.deb/);
  assert.match(body, /https:\/\/github\.com\/IGNGserver\/token-monitor-suite#readme/);
  assert.doesNotMatch(body, /\{\{/);
});

test('release body is Chinese-only for the app updater', () => {
  const notes = extractReleaseNotes(renderReleaseBody(template, { version: '0.47.0' }));
  assert.deepEqual(Object.keys(notes), ['zh']);
  assert.deepEqual(notes.zh.map((group) => group.title), ['修复']);
});

test('download list is built from the artifact table and covers every published platform', () => {
  const lines = releaseDownloadLines({ version: '1.2.3', repository: 'acme/repo' }).split('\n');
  assert.equal(lines.length, RELEASE_ARTIFACTS.length);
  for (const line of lines) assert.match(line, /^- \*\*.+\*\* — \[.+\]\(https:\/\/github\.com\/acme\/repo\/releases\/download\/v1\.2\.3\/.+\)(（[^）]+）)?$/);
  assert.ok(lines.some((line) => line.includes('Token-Monitor-Android-1.2.3.apk')), 'Android APK must never be missing from the list');
  assert.ok(lines.some((line) => line.includes('Token-Monitor-1.2.3.deb')), 'The .deb must be listed for App Center / APT users');
  assert.ok(lines.some((line) => line.includes('Token-Monitor-Setup-1.2.3.exe')));
  assert.ok(lines.some((line) => line.includes('Token-Monitor-1.2.3-arm64.dmg')));
  assert.ok(lines.some((line) => line.includes('Token-Monitor-1.2.3.AppImage')));
  const labels = RELEASE_ARTIFACTS.map((artifact) => `- **${artifact.label}**`);
  assert.deepEqual(lines.map((line) => line.match(/^- \*\*.+?\*\*/)?.[0] ?? ''), labels);
});

test('hub section follows the release channel', () => {
  const pre = hubDeploymentSection({ version: '1.2.3-rev.4', repositoryOwner: 'Acme', releaseType: 'prerelease' });
  assert.match(pre, /docker pull ghcr\.io\/acme\/token-monitor-hub:1\.2\.3-rev\.4\n```/);
  assert.doesNotMatch(pre, /:latest/);
  assert.match(pre, /不会移动 `latest` 标签/);

  const formal = hubDeploymentSection({ version: '1.2.3', repositoryOwner: 'Acme', releaseType: 'release' });
  assert.match(formal, /docker pull ghcr\.io\/acme\/token-monitor-hub:latest/);
  assert.doesNotMatch(formal, /不会移动/);
});

test('renderer refuses a release body it cannot describe', () => {
  const empty = template.replace('- 旧版本说明。', '');
  assert.throws(() => renderReleaseBody(empty, { version: '1.0.0' }), /本次更新 block is empty/);
  assert.throws(() => renderReleaseBody(template, { version: ' ' }), /requires a version/);
  assert.throws(() => renderReleaseBody(template.replace('{{tag}}', '{{unknown}}'), { version: '1.0.0' }), /unknown release template placeholder/);
  assert.throws(
    () => renderReleaseBody(template.replace('<!-- release-downloads -->', ''), { version: '1.0.0' }),
    /exactly one download list marker/
  );
  assert.throws(
    () => renderReleaseBody(`${template}\n<!-- release-hub-image -->`, { version: '1.0.0' }),
    /exactly one Hub deployment marker/
  );
});

test('prose-only release notes are accepted', () => {
  const prose = template.replace('### 修复\n- 旧版本说明。', '这一版只把深色主题换成纯黑底色，其余没有改动。');
  const body = renderReleaseBody(prose, { version: '1.0.0' });
  assert.match(body, /这一版只把深色主题换成纯黑底色/);
  // The app updater only parses `###` groups, so prose simply yields no in-app notes.
  assert.deepEqual(extractReleaseNotes(body), {});
});

test('the committed template renders for the current project version', () => {
  const body = renderReleaseBody(fs.readFileSync(templatePath, 'utf8'), {
    version: rootPackage.version,
    repositoryOwner: 'IGNGserver',
    releaseType: 'prerelease'
  });

  const notes = extractReleaseNotes(body);
  assert.deepEqual(Object.keys(notes), ['zh']);
  assert.ok(notes.zh.length > 0);
  assert.ok(notes.zh.every((group) => group.items.length > 0));
  assert.equal((body.match(/^## /gm) || []).length >= 2, true);
  for (const stale of ['<!-- app-update-notes:en:start -->', 'Full Changelog', '繁體中文', '한국어', '日本語', "## What's changed"]) {
    assert.ok(!body.includes(stale), `release body must not carry ${stale}`);
  }
});

test('every listed download is uploaded by the release job', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const uploadBlock = workflow.split('uses: softprops/action-gh-release@v2')[1];
  assert.ok(uploadBlock, 'the release job must publish the release');
  const globs = uploadBlock
    .split('\n')
    .filter((line) => line.trim().startsWith('artifacts/'))
    .map((line) => line.trim().replace(/^artifacts\//, '').replace(/\*\*/g, '*'));
  assert.ok(globs.length > 0);

  const names = RELEASE_ARTIFACTS.map((artifact) => artifact.file.replaceAll('{version}', rootPackage.version));
  for (const name of names) {
    const matched = globs.some((pattern) => {
      const regex = new RegExp(`^${pattern.replace(/[.+]/g, '\\$&').replace(/\*/g, '.*')}$`);
      return regex.test(name);
    });
    assert.ok(matched, `${name} is in the download list but not uploaded by the release job`);
  }
});

test('release workflow renders the body and adds no notes of its own', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /scripts\/generate-release-notes\.js/);
  assert.match(workflow, /--output release-body\.md/);
  assert.match(workflow, /--release-type "\$\{RELEASE_TYPE\}"/);
  assert.doesNotMatch(workflow, /cat \.github\/RELEASE_TEMPLATE\.md/);
  assert.doesNotMatch(workflow, /Hub Docker image/);
  assert.doesNotMatch(workflow, /github-generated-release-notes/);
});

test('generateReleaseBody writes the rendered body to disk', (t) => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'token-monitor-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = generateReleaseBody({
    version: rootPackage.version,
    templatePath,
    outputPath: path.join(dir, 'release-body.md'),
    cwd: root
  });
  const onDisk = fs.readFileSync(result.outputPath, 'utf8');
  assert.equal(onDisk.trimEnd(), result.body.trimEnd());
  assert.ok(onDisk.endsWith('\n'));
});
