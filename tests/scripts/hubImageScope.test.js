'use strict';

// The Hub image must contain every path the running server reads.
//
// This exists because the shared-UI extraction moved the dashboard out of
// src/hub/web into src/shared-ui and the Dockerfile was not updated with it. The
// image still built, the container started, /api/health returned 200 and the API
// worked — but every page asset 404'd and the dashboard rendered blank. Nothing
// in npm run verify could catch it, because nothing there builds the image.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..', '..');

function dockerfileCopies() {
  const source = fs.readFileSync(path.join(rootDir, 'Dockerfile'), 'utf8');
  const copies = new Set();
  for (const match of source.matchAll(/^COPY\s+(?:--from=\S+\s+)?(\S+)\s+(\S+)\s*$/gm)) {
    // Only source paths that live in the build context are meaningful here.
    if (match[1].startsWith('/')) continue;
    copies.add(match[1].replace(/^\.\//, ''));
  }
  return copies;
}

test('the Hub image copies every root the Hub serves', () => {
  const copies = dockerfileCopies();

  // Roots src/hub/static.js resolves and the entrypoint runs. Each must be
  // present in the image, or the server starts and then cannot serve its UI.
  const requiredRoots = [
    'src/hub',        // server.js + static.js + web/ (shell, PWA assets, boot.js)
    'src/shared',     // every shared adapter the Hub requires
    'src/shared-ui',  // the dashboard UI served under /ui/ and /icons/clients//*
    'migrations',     // docker-entrypoint.sh runs migrations/run.js
    'package.json'
  ];
  const missing = requiredRoots.filter((entry) => !copies.has(entry));
  assert.deepEqual(missing, [], `Dockerfile does not COPY: ${missing.join(', ')}`);
});

test('the shared UI served by the Hub exists in this tree', () => {
  // Guards the other direction: if the package is ever moved again, the check
  // above would keep passing while the server resolves nothing.
  const staticSource = fs.readFileSync(path.join(rootDir, 'src', 'hub', 'static.js'), 'utf8');
  const match = staticSource.match(/SHARED_UI_ROOT = path\.join\(__dirname, ([^)]+)\)/);
  assert.ok(match, 'static.js should declare SHARED_UI_ROOT');
  const segments = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const resolved = path.join(rootDir, 'src', 'hub', ...segments);
  assert.ok(fs.existsSync(resolved), `the Hub serves ${resolved}, which does not exist`);
  assert.ok(fs.existsSync(path.join(resolved, 'app.js')), 'the shared UI entry must be present');
  assert.ok(
    fs.existsSync(path.join(resolved, 'icons', 'clients')),
    'the client icon tree must be present (the Hub serves /icons/clients from it)'
  );
});

test('every path the Hub serves is inside a copied root', () => {
  const copies = dockerfileCopies();
  const staticSource = fs.readFileSync(path.join(rootDir, 'src', 'hub', 'static.js'), 'utf8');
  // Collect the roots static.js will read from.
  const roots = [...staticSource.matchAll(/path\.join\(__dirname, ([^\n]+)\)/g)]
    .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((seg) => seg[1]))
    .filter((seg) => seg !== '..');
  for (const root of roots) {
    // Compare with forward slashes on both sides. Dockerfile paths are always
    // POSIX, and path.join produces backslashes on Windows, so a joined string
    // never matched the COPY entries there — this test failed on the Windows CI
    // runner for exactly that reason.
    const relative = ['src', 'hub', root].join('/');
    const covered = [...copies].some((entry) => {
      const normalized = entry.split(path.sep).join('/').replace(/\/$/, '');
      return relative === normalized || relative.startsWith(`${normalized}/`);
    });
    assert.ok(covered, `static.js serves ${relative}, which the Dockerfile does not copy`);
  }
});
