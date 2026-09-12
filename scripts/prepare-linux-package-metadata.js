'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'packaging', 'linux', 'token-monitor.metainfo.xml.in');
const DEFAULT_OUTPUT_PATH = path.join(PROJECT_ROOT, 'build', 'linux', 'token-monitor.metainfo.xml');

function normalizeReleaseDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Release date must use YYYY-MM-DD: ${date || '(empty)'}`);
  }
  return date;
}

function releaseDateFromEnv(env = process.env) {
  const configured = String(env.TOKEN_MONITOR_RELEASE_DATE || '').trim();
  return configured ? normalizeReleaseDate(configured) : new Date().toISOString().slice(0, 10);
}

function prepareLinuxPackageMetadata({
  version,
  releaseDate = releaseDateFromEnv(),
  templatePath = TEMPLATE_PATH,
  outputPath = DEFAULT_OUTPUT_PATH
} = {}) {
  const normalizedVersion = String(version || '').trim();
  if (!normalizedVersion) throw new Error('A project version is required for AppStream metadata');
  const template = fs.readFileSync(templatePath, 'utf8');
  const rendered = template
    .replaceAll('__VERSION__', normalizedVersion)
    .replaceAll('__RELEASE_DATE__', normalizeReleaseDate(releaseDate));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered.endsWith('\n') ? rendered : `${rendered}\n`);
  return outputPath;
}

if (require.main === module) {
  const packageJson = require('../package.json');
  const outputPath = prepareLinuxPackageMetadata({ version: packageJson.version });
  console.log(`Prepared Linux AppStream metadata: ${outputPath}`);
}

module.exports = {
  DEFAULT_OUTPUT_PATH,
  TEMPLATE_PATH,
  normalizeReleaseDate,
  prepareLinuxPackageMetadata,
  releaseDateFromEnv
};
