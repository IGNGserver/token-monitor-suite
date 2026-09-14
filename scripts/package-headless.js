#!/usr/bin/env node
'use strict';

// Build the platform-neutral source bundle for machines without a desktop GUI:
//   Token-Monitor-Headless-<version>.tar.gz
//
// Dependencies are intentionally installed by the operator with
// `npm ci --omit=dev` on the target machine. That keeps Electron out of the
// headless install while npm still selects the target platform's tokscale
// package.

const fs = require('node:fs');
const path = require('node:path');
const tar = require('tar');

const root = path.resolve(__dirname, '..');
const requestedVersion = process.argv[2] || process.env.TOKEN_MONITOR_VERSION || '';
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(requestedVersion || packageJson.version).replace(/^v/, '');
if (!/^\d+\.\d+\.\d+-rev\.\d+$/.test(version)) {
  throw new Error(`invalid headless package version: ${version}`);
}

const outDir = path.join(root, 'dist-headless');
const stageName = `token-monitor-headless-${version}`;
const stageDir = path.join(outDir, stageName);
const archivePath = path.join(outDir, `Token-Monitor-Headless-${version}.tar.gz`);
const files = [
  ['src/agent', 'src/agent'],
  ['src/shared', 'src/shared'],
  ['package.json', 'package.json'],
  ['package-lock.json', 'package-lock.json'],
  ['.env.example', '.env.example'],
  ['docs/headless-agent.md', 'README.md'],
  ['LICENSE', 'LICENSE']
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });
for (const [sourceRelative, destinationRelative] of files) {
  const source = path.join(root, sourceRelative);
  const destination = path.join(stageDir, destinationRelative);
  if (!fs.existsSync(source)) throw new Error(`missing ${sourceRelative}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

async function main() {
  await tar.c({ cwd: outDir, gzip: true, file: archivePath }, [stageName]);
  if (!fs.existsSync(archivePath)) throw new Error(`failed to create ${archivePath}`);
  console.log(archivePath);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
