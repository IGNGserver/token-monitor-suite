'use strict';

// The Docker Hub image installed 47.9 MB of node_modules to run 7.3 MB of code,
// because one root package.json means `npm ci --omit=dev` also pulls the
// Electron/agent/updater stack — including the 25.9 MB tokscale native binary the
// Hub never spawns. These tests pin the keep-list so pruning cannot remove a
// package the Hub actually loads.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { KEEP, pruneHubNodeModules } = require('../../scripts/prune-hub-deps');

const rootDir = path.join(__dirname, '..', '..');

function fakeModules(names) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-hub-'));
  const nodeModules = path.join(dir, 'node_modules');
  for (const name of names) {
    const target = path.join(nodeModules, name);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'blob.bin'), Buffer.alloc(2048));
  }
  return nodeModules;
}

test('the prune keep-list covers every package the Hub closure requires', () => {
  // Walk the real closure from src/hub/server.js rather than every file under
  // src/shared: src/shared also holds client-only modules (e.g. tokscaleUpdater,
  // which is the only `tar` user), and those are correctly pruned.
  const seen = new Set();
  const packages = new Set();
  const pending = [path.join(rootDir, 'src', 'hub', 'server.js')];
  const pattern = /(?:require\(|from\s+)['"]([^'"]+)['"]/g;

  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    for (const match of fs.readFileSync(file, 'utf8').matchAll(pattern)) {
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

  assert.ok(seen.size > 20, `expected to walk the Hub closure, saw ${seen.size} files`);
  // Only packages that are actually installed can be compared against the list.
  const needed = [...packages].filter((name) => fs.existsSync(path.join(rootDir, 'node_modules', name)));
  assert.ok(needed.includes('mysql2'), 'the closure should reach mysql2');
  assert.ok(needed.includes('koffi'), 'the closure should reach koffi (lazily, via limitCollector)');
  const missing = needed.filter((name) => !KEEP.has(name) && !name.startsWith('@koromix/'));
  assert.deepEqual(missing, [], `packages the Hub needs but the prune keep-list would delete: ${missing.join(', ')}`);
  for (const name of ['chokidar', 'dotenv', 'koffi', 'mysql2', 'semver', 'undici']) {
    assert.ok(KEEP.has(name), `keep-list should retain ${name}`);
  }
  // tar is reached only by the client-side tokscale updater, so pruning it is correct.
  assert.ok(!needed.includes('tar'), 'tar should not be in the Hub closure');
});

test('pruning removes unused packages, including scoped ones, and keeps the rest', () => {
  const nodeModules = fakeModules([
    'chokidar', 'dotenv', 'koffi', 'mysql2', 'semver', 'undici',
    'tar', 'electron-updater', 'js-yaml',
    '@tokscale/cli-linux-x64-gnu',
    '@discordjs/rest',
    '@koromix/koffi-linux-x64'
  ]);
  const result = pruneHubNodeModules(nodeModules, { log: () => {} });

  const remaining = fs.readdirSync(nodeModules).sort();
  for (const kept of ['chokidar', 'dotenv', 'koffi', 'mysql2', 'semver', 'undici', '@koromix']) {
    assert.ok(remaining.includes(kept), `${kept} should survive pruning`);
  }
  assert.ok(!remaining.includes('tar'), 'tar should be pruned');
  assert.ok(!remaining.includes('@tokscale'), 'an emptied scope directory should be removed');
  // tar, electron-updater, js-yaml and the two scoped packages are all unused here.
  assert.equal(result.removed, 5, 'the five unused packages should be removed');
  assert.ok(result.removedBytes > 0);
});

test('pruning an empty scope leaves the scope directory intact', () => {
  const nodeModules = fakeModules(['mysql2', '@sapphire/async-queue']);
  pruneHubNodeModules(nodeModules, { log: () => {} });
  assert.ok(fs.existsSync(path.join(nodeModules, 'mysql2')));
  assert.ok(!fs.existsSync(path.join(nodeModules, '@sapphire')));
});

test('the Dockerfile prunes before copying node_modules into the runtime image', () => {
  const dockerfile = fs.readFileSync(path.join(rootDir, 'Dockerfile'), 'utf8');
  const pruneIndex = dockerfile.indexOf('node scripts/prune-hub-deps.js');
  assert.notEqual(pruneIndex, -1, 'the dependencies stage should run the prune script');
  assert.match(dockerfile, /COPY scripts\/prune-hub-deps\.js/);
  const copyIndex = dockerfile.indexOf('COPY --from=dependencies /app/node_modules');
  assert.ok(copyIndex > pruneIndex, 'node_modules must be pruned before it is copied');
});
