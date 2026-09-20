'use strict';

// The headless bundle used to ship the root package.json, so the operator's
// documented `npm ci --omit=dev` installed 47.9 MB for a 25.0 MB closure — the
// widget, updater and Hub driver are all unreachable from src/agent/agent.js.
// The bundle now emits a manifest scoped to the real closure; these assertions
// keep the two in step (and keep `tokscale`, whose per-platform optional
// dependency is how npm picks the target machine's native binary).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..', '..');
const packageJson = require(path.join(rootDir, 'package.json'));

function agentClosurePackages() {
  const seen = new Set();
  const packages = new Set();
  const pending = [path.join(rootDir, 'src', 'agent', 'agent.js')];
  const pattern = /(?:require\(|from\s+)['"]([^'"]+)['"]/g;

  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier.startsWith('node:')) continue;
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), specifier);
        for (const candidate of [resolved, `${resolved}.js`, path.join(resolved, 'index.js')]) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            pending.push(candidate);
            break;
          }
        }
        continue;
      }
      packages.add(specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0]);
    }
  }
  return packages;
}

test('the agent dependency closure is a small, declared subset of the root manifest', () => {
  const packages = agentClosurePackages();
  // tokscale is resolved dynamically (require.resolve('tokscale/bin.js')), so it
  // must be added explicitly rather than discovered by the static walk.
  const needed = new Set([...packages, 'tokscale']);
  assert.ok(needed.has('chokidar'), 'chokidar should be in the agent closure');
  assert.ok(needed.has('dotenv'), 'dotenv should be in the agent closure');
  assert.ok(needed.has('tokscale'), 'tokscale is resolved dynamically and must be kept');

  // Client/Hub-only packages must NOT be required by the agent.
  for (const excluded of ['electron-updater', 'mysql2', 'koffi', '@xhayper/discord-rpc']) {
    assert.ok(!packages.has(excluded), `${excluded} should not be part of the agent closure`);
  }
  // Everything the agent needs must be declared in the root manifest, otherwise
  // the generated bundle manifest cannot carry a version range.
  for (const name of needed) {
    assert.ok(packageJson.dependencies?.[name], `${name} should be a declared dependency`);
  }
});

test('the packager emits a bundle-scoped manifest, not the root one', () => {
  const source = fs.readFileSync(path.join(rootDir, 'scripts', 'package-headless.js'), 'utf8');
  // The root manifest must not simply be copied into the bundle any more.
  assert.ok(
    !/\[\s*'package\.json',\s*'package\.json'\s*\]/.test(source),
    'package-headless.js should no longer stage the root package.json verbatim'
  );
  assert.match(source, /HEADLESS_DEPENDENCIES/, 'the bundle manifest should list its own dependencies');
  assert.match(source, /--package-lock-only/, 'the bundle should generate a lockfile for npm ci');
  assert.match(source, /package-lock\.json/, 'the package-lock.json must be checked before archiving');
  for (const name of ['chokidar', 'dotenv', 'semver', 'tokscale']) {
    assert.ok(source.includes(`'${name}'`), `the bundle manifest should declare ${name}`);
  }
  // A bundle manifest must not point at the Electron entry point.
  assert.ok(
    !/main:\s*'src\/electron/.test(source),
    'the bundle main should not be the Electron entry point'
  );
});

test('the headless packager accepts a plain SemVer release version', () => {
  // The guard used to be a `-rev.N` regex, but AGENTS.md documents the revision
  // suffix as optional and verify-release-version accepts a bare version. That
  // made the release's headless job fail for 0.46.0 while npm run verify was
  // green, because verify never invokes this script.
  const source = fs.readFileSync(path.join(rootDir, 'scripts', 'package-headless.js'), 'utf8');
  assert.match(source, /parseProjectVersion/, 'the guard should use the shared version parser');
  assert.doesNotMatch(
    source,
    /\^\\d\+\\\.\\d\+\\\.\\d\+-rev\\\./,
    'a rev-only regex must not gate a release version'
  );

  const { parseProjectVersion } = require(path.join(rootDir, 'src', 'shared', 'versioning'));
  assert.ok(parseProjectVersion('0.46.0'), 'a bare SemVer release must be accepted');
  assert.ok(parseProjectVersion('0.46.0-rev.1'), 'a revision release must still be accepted');
  assert.equal(parseProjectVersion('not-a-version'), null, 'garbage must still be rejected');
});
