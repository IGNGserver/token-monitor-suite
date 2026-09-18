'use strict';

// The packaged widget should not carry the Hub's database driver, source maps,
// or dependency documentation. These are measured wins (mysql2 ~1.4 MB plus its
// exclusive transitive deps, ~5 MB of .map files, ~1.2 MB of docs/headers) and
// the only risk is excluding something the Electron process actually loads, so
// the exclusions are pinned together with the closure check that proves they are
// safe.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..', '..');
const packageJson = require(path.join(rootDir, 'package.json'));

test('the Electron package excludes Hub-only, map and documentation payloads', () => {
  const files = packageJson.build.files;
  const exclusions = files.filter((entry) => entry.startsWith('!'));

  const required = [
    '!node_modules/**/*.map',
    '!node_modules/mysql2/**'
  ];
  for (const pattern of required) {
    assert.ok(exclusions.includes(pattern), `build.files should exclude ${pattern}`);
  }
  assert.ok(
    exclusions.some((entry) => entry.includes('{md,markdown,h,hh,hpp,c,cc,cpp}')),
    'build.files should exclude dependency documentation and native build headers'
  );
  // The runtime entries must survive.
  for (const keep of ['src/electron/**/*', 'src/shared/**/*', 'assets/icons/**/*']) {
    assert.ok(files.includes(keep), `build.files should still include ${keep}`);
  }
});

test('nothing the Electron main process loads requires mysql2', () => {
  // Only the Hub talks to MySQL (src/hub/repository.js), and src/hub is already
  // outside the package, so excluding the driver cannot break the widget.
  const seen = new Set();
  const pending = [path.join(rootDir, 'src', 'electron', 'main.js')];
  const specifierPattern = /(?:require\(|from\s+)['"]([^'"]+)['"]/g;

  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(specifierPattern)) {
      const specifier = match[1];
      if (specifier.startsWith('node:') || !specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      for (const candidate of [resolved, `${resolved}.js`, path.join(resolved, 'index.js')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          pending.push(candidate);
          break;
        }
      }
    }
  }

  assert.ok(seen.size > 50, `expected to walk the Electron closure, saw ${seen.size} files`);
  const offenders = [...seen].filter((file) => /require\(['"]mysql2/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(
    offenders.map((file) => path.relative(rootDir, file)),
    [],
    'the Electron closure must not require mysql2'
  );
  // And the Hub must still require it, so the exclusion is scoped to Electron only.
  const hubRepository = fs.readFileSync(path.join(rootDir, 'src', 'hub', 'repository.js'), 'utf8');
  assert.match(hubRepository, /require\('mysql2\/promise'\)/);
});

test('no runtime code requires an extension the packaging excludes', () => {
  // Excluding *.md/*.h is only safe if nothing require()s one at runtime.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/require\(['"]([^'"]+\.(?:md|markdown|h|hh|hpp|c|cc|cpp))['"]\)/g)) {
        offenders.push(`${path.relative(rootDir, full)} -> ${match[1]}`);
      }
    }
  };
  walk(path.join(rootDir, 'src'));
  assert.deepEqual(offenders, [], `runtime requires of excluded extensions: ${offenders.join(', ')}`);
});
