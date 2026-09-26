'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPOSITORY = 'IGNGserver/token-monitor-suite';
const DEFAULT_TEMPLATE = '.github/RELEASE_TEMPLATE.md';
const DEFAULT_OUTPUT = 'release-body.md';
const HUB_IMAGE_NAME = 'token-monitor-hub';

const NOTES_START_MARKER = '<!-- app-update-notes:zh:start -->';
const NOTES_END_MARKER = '<!-- app-update-notes:zh:end -->';
const DOWNLOADS_MARKER = '<!-- release-downloads -->';
const HUB_MARKER = '<!-- release-hub-image -->';

/**
 * The download list and the only place release artifact file names are spelled out.
 * `tests/shared/releaseArtifactNames.test.js` ties every row back to the
 * electron-builder `artifactName` patterns and to the release job's upload globs, so an
 * artifact that exists on the release page can no longer be missing from the list —
 * that is how the Android APK stayed off every release body.
 */
const RELEASE_ARTIFACTS = Object.freeze([
  { label: 'macOS Apple Silicon', file: 'Token-Monitor-{version}-arm64.dmg', note: '' },
  { label: 'macOS Intel', file: 'Token-Monitor-{version}-x64.dmg', note: '' },
  { label: 'Windows 安装版', file: 'Token-Monitor-Setup-{version}.exe', note: '推荐' },
  { label: 'Windows 便携版', file: 'Token-Monitor-{version}.exe', note: '免安装' },
  { label: 'Linux x64 AppImage', file: 'Token-Monitor-{version}.AppImage', note: '应用内自动更新用这个' },
  { label: 'Linux x64 Debian 包', file: 'Token-Monitor-{version}.deb', note: 'App Center / APT 更新链路用这个' },
  { label: 'Android 手机端', file: 'Token-Monitor-Android-{version}.apk', note: 'Hub 的读端，已用长期签名密钥签名' }
]);

function projectVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function assertExactlyOne(body, marker, description) {
  const count = body.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(`expected exactly one ${description} marker (${marker}) in the release template, found ${count}`);
  }
}

function markedNotesSection(body) {
  assertExactlyOne(body, NOTES_START_MARKER, 'Chinese release-note start');
  assertExactlyOne(body, NOTES_END_MARKER, 'Chinese release-note end');
  const start = body.indexOf(NOTES_START_MARKER) + NOTES_START_MARKER.length;
  const end = body.indexOf(NOTES_END_MARKER, start);
  const section = body.slice(start, end).trim();
  // Prose is allowed (the whole point is a human-written Chinese summary), but a block
  // that still holds only headings means nobody wrote this release's notes.
  const content = section.split(/\r?\n/).filter((line) => line.trim() && !/^\s*#/.test(line));
  if (content.length === 0) {
    throw new Error(
      'the 本次更新 block is empty: write what this release changed into the marked block of the release template before tagging'
    );
  }
  return section;
}

function artifactFile(artifact, version) {
  return artifact.file.replaceAll('{version}', version);
}

function releaseDownloadLines({ version, repository }) {
  const base = `https://github.com/${repository}/releases/download/v${version}`;
  return RELEASE_ARTIFACTS.map((artifact) => {
    const file = artifactFile(artifact, version);
    const note = artifact.note ? `（${artifact.note}）` : '';
    return `- **${artifact.label}** — [${file}](${base}/${file})${note}`;
  }).join('\n');
}

function hubDeploymentSection({ version, repositoryOwner, releaseType }) {
  const image = `ghcr.io/${String(repositoryOwner || '').toLowerCase()}/${HUB_IMAGE_NAME}`;
  const lines = [
    '---',
    '',
    '## Hub 镜像与 Compose',
    '',
    '```bash',
    `docker pull ${image}:${version}`
  ];
  if (releaseType === 'release') lines.push(`docker pull ${image}:latest`);
  lines.push('```', '');
  if (releaseType === 'release') {
    lines.push(`Compose：在 \`.env\` 里设 \`TOKEN_MONITOR_VERSION=${version}\`（或 \`latest\`），然后 \`docker compose pull && docker compose up -d\`。`);
  } else {
    lines.push(`Compose：在 \`.env\` 里设 \`TOKEN_MONITOR_VERSION=${version}\`，然后 \`docker compose pull && docker compose up -d\`。本次是 prerelease，不会移动 \`latest\` 标签。`);
  }
  lines.push(
    '',
    `最小部署包是 Assets 里的 \`Token-Monitor-Hub-Compose-${version}.zip\`；不带图形界面的采集器用 \`Token-Monitor-Headless-${version}.tar.gz\`，解压后执行 \`npm ci --omit=dev\`。`
  );
  return lines.join('\n');
}

function substitutePlaceholders(text, values) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`unknown release template placeholder: ${match}`);
    }
    return values[key];
  });
}

function renderReleaseBody(template, {
  version,
  repository = DEFAULT_REPOSITORY,
  repositoryOwner,
  releaseType = 'prerelease'
} = {}) {
  const cleanVersion = projectVersion(version);
  if (!cleanVersion) throw new Error('renderReleaseBody requires a version');

  const substituted = substitutePlaceholders(template, {
    version: cleanVersion,
    tag: `v${cleanVersion}`,
    repository,
    repositoryUrl: `https://github.com/${repository}`
  });

  // Read the notes after substitution so a version token can never leak into the
  // section the app updater parses out of the release body.
  markedNotesSection(substituted);
  assertExactlyOne(substituted, DOWNLOADS_MARKER, 'download list');
  assertExactlyOne(substituted, HUB_MARKER, 'Hub deployment');

  const body = substituted
    .replace(DOWNLOADS_MARKER, releaseDownloadLines({ version: cleanVersion, repository }))
    .replace(HUB_MARKER, hubDeploymentSection({
      version: cleanVersion,
      repositoryOwner: repositoryOwner || repository.split('/')[0],
      releaseType
    }));

  if (/\{\{/.test(body)) {
    throw new Error('the rendered release body still contains an unresolved {{ placeholder');
  }
  markedNotesSection(body);
  return body;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function generateReleaseBody({
  version,
  templatePath = DEFAULT_TEMPLATE,
  outputPath = DEFAULT_OUTPUT,
  repository = DEFAULT_REPOSITORY,
  repositoryOwner,
  releaseType = 'prerelease',
  cwd = process.cwd()
} = {}) {
  const template = fs.readFileSync(path.resolve(cwd, templatePath), 'utf8');
  const body = renderReleaseBody(template, {
    version,
    repository,
    repositoryOwner,
    releaseType
  });
  const resolvedOutput = path.resolve(cwd, outputPath);
  fs.writeFileSync(resolvedOutput, `${body.trimEnd()}\n`, 'utf8');
  return { body, outputPath: resolvedOutput };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const repository = String(args.repository || DEFAULT_REPOSITORY).trim();
  const result = generateReleaseBody({
    version: args.version || '',
    templatePath: args.template || DEFAULT_TEMPLATE,
    outputPath: args.output || DEFAULT_OUTPUT,
    repository,
    repositoryOwner: args.owner,
    releaseType: args['release-type'] || 'prerelease'
  });
  console.log(`Rendered release body for ${projectVersion(args.version)} -> ${result.outputPath}`);
}

module.exports = {
  DEFAULT_REPOSITORY,
  DOWNLOADS_MARKER,
  HUB_MARKER,
  NOTES_END_MARKER,
  NOTES_START_MARKER,
  RELEASE_ARTIFACTS,
  artifactFile,
  generateReleaseBody,
  hubDeploymentSection,
  projectVersion,
  releaseDownloadLines,
  renderReleaseBody
};
