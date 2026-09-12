'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');

function parseArgs(argv) {
  const options = {
    inputDir: '',
    outputDir: '',
    suite: 'stable',
    component: 'main',
    architecture: 'amd64',
    signingKey: '',
    requireSignature: false,
    releaseDate: new Date().toISOString().slice(0, 10)
  };
  const keys = {
    '--input-dir': 'inputDir',
    '--output-dir': 'outputDir',
    '--suite': 'suite',
    '--component': 'component',
    '--architecture': 'architecture',
    '--signing-key': 'signingKey',
    '--release-date': 'releaseDate'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--require-signature') {
      options.requireSignature = true;
      continue;
    }
    if (keys[arg]) {
      options[keys[arg]] = argv[++index] || '';
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.inputDir || !options.outputDir) throw new Error('Both --input-dir and --output-dir are required');
  if (!/^[-a-z0-9]+$/i.test(options.suite)) throw new Error(`Invalid APT suite: ${options.suite}`);
  if (!/^[-a-z0-9]+$/i.test(options.component)) throw new Error(`Invalid APT component: ${options.component}`);
  if (!/^[-a-z0-9]+$/i.test(options.architecture)) throw new Error(`Invalid APT architecture: ${options.architecture}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.releaseDate)) throw new Error(`Invalid release date: ${options.releaseDate}`);
  return options;
}

function findDebianPackages(inputDir) {
  return fs.readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.deb'))
    .map((entry) => path.join(inputDir, entry.name));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function hashFile(filePath, algorithm) {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest('hex');
}

function releaseEntry(filePath, releaseRoot) {
  const relativePath = path.relative(releaseRoot, filePath).split(path.sep).join('/');
  const size = fs.statSync(filePath).size;
  return {
    relativePath,
    size,
    md5: hashFile(filePath, 'md5'),
    sha256: hashFile(filePath, 'sha256')
  };
}

function renderReleaseFile({ suite, component, architecture, releaseDate, files }) {
  const date = new Date(`${releaseDate}T00:00:00Z`).toUTCString();
  const rows = (algorithm) => files
    .map((file) => ` ${file[algorithm]} ${file.size} ${file.relativePath}`)
    .join('\n');
  return [
    'Origin: Token Monitor',
    'Label: Token Monitor',
    `Suite: ${suite}`,
    `Codename: ${suite}`,
    `Date: ${date}`,
    `Architectures: ${architecture}`,
    `Components: ${component}`,
    'Description: Token Monitor Debian packages',
    'MD5Sum:',
    rows('md5'),
    'SHA256:',
    rows('sha256'),
    ''
  ].join('\n');
}

function runDpkgScanpackages(repositoryRoot, poolPath) {
  return execFileSync(
    'dpkg-scanpackages',
    [poolPath, '/dev/null'],
    { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function compressPackages(packagesPath) {
  const packages = fs.readFileSync(packagesPath);
  fs.writeFileSync(`${packagesPath}.gz`, gzipSync(packages, { mtime: 0 }));
  try {
    const xz = execFileSync('xz', ['--format=xz', '--stdout'], { input: packages });
    fs.writeFileSync(`${packagesPath}.xz`, xz);
  } catch (error) {
    throw new Error(`xz is required to publish the APT repository: ${error.message || error}`, { cause: error });
  }
}

function signRelease({ releasePath, releaseGpgPath, inReleasePath, signingKey }) {
  const commonArgs = ['--batch', '--yes', '--local-user', signingKey];
  execFileSync('gpg', [...commonArgs, '--armor', '--detach-sign', '--output', releaseGpgPath, releasePath], { stdio: 'inherit' });
  execFileSync('gpg', [...commonArgs, '--armor', '--clearsign', '--output', inReleasePath, releasePath], { stdio: 'inherit' });
}

function buildAptRepository({
  inputDir,
  outputDir,
  suite = 'stable',
  component = 'main',
  architecture = 'amd64',
  signingKey = '',
  requireSignature = false,
  releaseDate = new Date().toISOString().slice(0, 10)
} = {}) {
  const packages = findDebianPackages(inputDir);
  if (packages.length === 0) throw new Error(`No .deb package found in ${inputDir}`);
  if (requireSignature && !signingKey) throw new Error('APT repository signing is required but --signing-key is missing');

  const repositoryRoot = path.resolve(outputDir);
  const poolRelativePath = path.posix.join('pool', component, 't', 'token-monitor');
  const poolPath = path.join(repositoryRoot, ...poolRelativePath.split('/'));
  const releaseRoot = path.join(repositoryRoot, 'dists', suite);
  const binaryRoot = path.join(releaseRoot, component, `binary-${architecture}`);
  fs.mkdirSync(poolPath, { recursive: true });
  fs.mkdirSync(binaryRoot, { recursive: true });

  for (const packagePath of packages) fs.copyFileSync(packagePath, path.join(poolPath, path.basename(packagePath)));
  const packagesText = runDpkgScanpackages(repositoryRoot, poolRelativePath);
  const packagesPath = path.join(binaryRoot, 'Packages');
  writeFile(packagesPath, packagesText);
  compressPackages(packagesPath);

  const releasePath = path.join(releaseRoot, 'Release');
  const releaseFiles = [packagesPath, `${packagesPath}.gz`, `${packagesPath}.xz`]
    .map((filePath) => releaseEntry(filePath, releaseRoot));
  writeFile(releasePath, renderReleaseFile({ suite, component, architecture, releaseDate, files: releaseFiles }));

  const inReleasePath = path.join(releaseRoot, 'InRelease');
  const releaseGpgPath = path.join(releaseRoot, 'Release.gpg');
  if (signingKey) signRelease({ releasePath, releaseGpgPath, inReleasePath, signingKey });
  else {
    for (const filePath of [inReleasePath, releaseGpgPath]) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
  return { packagePaths: packages, releasePath, inReleasePath, releaseGpgPath, packagesPath };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = buildAptRepository(options);
    console.log(`Built APT repository metadata at ${result.releasePath}`);
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  buildAptRepository,
  findDebianPackages,
  parseArgs,
  renderReleaseFile
};
