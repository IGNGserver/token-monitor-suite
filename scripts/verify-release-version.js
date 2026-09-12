'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseProjectVersion } = require('../src/shared/versioning');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const VERSION_FILES = [
  ['package.json', ['version']],
  ['package-lock.json', ['version']],
  ['package-lock.json', ['packages', '', 'version']]
];

function readJson(relativePath) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function valueAtPath(value, pathParts) {
  return pathParts.reduce((current, part) => current?.[part], value);
}

function normalizeVersion(value) {
  const raw = typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
  return parseProjectVersion(raw)?.version || null;
}

function versionFromArgs(argv) {
  const index = argv.indexOf('--version');
  if (index >= 0) return argv[index + 1] || '';
  const inline = argv.find((arg) => arg.startsWith('--version='));
  return inline ? inline.slice('--version='.length) : '';
}

function verifyReleaseVersion(expectedValue = '') {
  const expected = normalizeVersion(expectedValue || readJson('package.json').version);
  if (!expected) {
    throw new Error(`Invalid project release version: ${String(expectedValue || readJson('package.json').version)}`);
  }

  for (const [relativePath, valuePath] of VERSION_FILES) {
    const actualValue = valueAtPath(readJson(relativePath), valuePath);
    const actual = normalizeVersion(actualValue);
    if (!actual) throw new Error(`${relativePath} contains an invalid project version: ${String(actualValue)}`);
    if (actual !== expected) {
      throw new Error(`${relativePath} version ${actual} does not match expected ${expected}`);
    }
  }
  return expected;
}

if (require.main === module) {
  try {
    const version = verifyReleaseVersion(versionFromArgs(process.argv.slice(2)));
    console.log(`Release version verified: ${version}`);
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  normalizeVersion,
  verifyReleaseVersion
};
