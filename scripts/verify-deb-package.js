'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function commandOutput(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readDebianControl(debPath) {
  const fields = {};
  for (const line of commandOutput('dpkg-deb', ['-f', debPath]).split(/\r?\n/)) {
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

function listDebianFiles(debPath) {
  return commandOutput('dpkg-deb', ['-c', debPath])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(line.lastIndexOf(' ') + 1));
}

function compareDebianVersions(left, operator, right) {
  try {
    execFileSync('dpkg', ['--compare-versions', left, operator, right], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if (error?.status === 1) return false;
    throw error;
  }
}

function verifyDebPackage(debPath, {
  expectedPackage = 'token-monitor',
  expectedVersion = '',
  expectedArchitecture = 'amd64',
  previousVersion = ''
} = {}) {
  if (!debPath || !fs.existsSync(debPath)) throw new Error(`Debian package does not exist: ${debPath}`);
  const control = readDebianControl(debPath);
  const files = new Set(listDebianFiles(debPath));
  const failures = [];

  if (control.Package !== expectedPackage) failures.push(`Package=${control.Package || '(missing)'}`);
  if (expectedVersion && control.Version !== expectedVersion) {
    failures.push(`Version=${control.Version || '(missing)'} (expected ${expectedVersion})`);
  }
  if (control.Architecture !== expectedArchitecture) {
    failures.push(`Architecture=${control.Architecture || '(missing)'} (expected ${expectedArchitecture})`);
  }
  for (const requiredFile of [
    './usr/share/applications/token-monitor.desktop',
    './usr/share/metainfo/token-monitor.metainfo.xml'
  ]) {
    if (!files.has(requiredFile)) failures.push(`missing ${requiredFile}`);
  }
  if (previousVersion && !compareDebianVersions(control.Version, 'gt', previousVersion)) {
    failures.push(`Version ${control.Version} is not greater than ${previousVersion}`);
  }

  if (failures.length > 0) {
    throw new Error(`${debPath}: ${failures.join('; ')}`);
  }
  return { control, files };
}

function parseArgs(argv) {
  const options = { packages: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--version' || arg === '--previous' || arg === '--package' || arg === '--architecture') {
      options[{ '--version': 'expectedVersion', '--previous': 'previousVersion', '--package': 'expectedPackage', '--architecture': 'expectedArchitecture' }[arg]] = argv[++index] || '';
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.packages.push(arg);
    }
  }
  if (options.packages.length === 0) throw new Error('Usage: node scripts/verify-deb-package.js <package.deb> [...more.deb] [--version VERSION]');
  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    for (const debPath of options.packages) {
      const result = verifyDebPackage(debPath, options);
      console.log(`${debPath}: ${result.control.Package} ${result.control.Version} ${result.control.Architecture}`);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  compareDebianVersions,
  listDebianFiles,
  readDebianControl,
  verifyDebPackage
};
