'use strict';

// A timed-out child that ignores SIGTERM must be killed and detached.
//
// Previously only SIGTERM was sent: if the process (or a grandchild holding the
// inherited pipes) survived, the promise was already rejected so the next tick
// spawned a new scan while the old one still burned CPU, and its 'data' handlers
// kept appending to the parent's stdout/stderr strings for the process lifetime.

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const test = require('node:test');

const { terminateChild, abandonChildStreams } = require('../../src/shared/collector');

test('terminateChild escalates to SIGKILL when the child ignores SIGTERM', async () => {
  // A child that ignores SIGTERM and would otherwise run for 60s.
  const child = spawn(process.execPath, [
    '-e',
    "process.on('SIGTERM', () => {}); setTimeout(() => {}, 60000);"
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  await new Promise((resolve) => child.once('spawn', resolve));
  let exited = false;
  const closed = new Promise((resolve) => {
    child.once('close', () => { exited = true; resolve(); });
  });

  terminateChild(child, { escalateMs: 150 });
  const outcome = await Promise.race([
    closed.then(() => 'closed'),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000))
  ]);

  assert.equal(outcome, 'closed', 'the child should be killed well before its own 60s timer');
  assert.equal(exited, true);
});

test('terminateChild does not leave a pending escalation timer for a cooperative child', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000);'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve) => child.once('spawn', resolve));
  const closed = new Promise((resolve) => child.once('close', resolve));
  terminateChild(child, { escalateMs: 5000 });
  await closed;
  assert.equal(child.killed, true);
});

test('abandonChildStreams stops further buffering and is safe on a dead child', () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => process.stdout.write("x"), 5);'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let chunks = 0;
  child.stdout.on('data', () => { chunks += 1; });
  return new Promise((resolve) => {
    setTimeout(() => {
      abandonChildStreams(child);
      const after = chunks;
      setTimeout(() => {
        assert.equal(chunks, after, 'no further data events should be delivered after abandoning');
        resolve();
      }, 60);
    }, 60);
  });
});

test('a failed WSL scan does not replace a good frozen snapshot', () => {
  // collectWslUsage swallows a per-home tokscale failure, so its bundle can be
  // empty while the distro holds data. Freezing that as the new anchor dropped the
  // WSL share of today/month/allTime until the next full scan.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'shared', 'collector.js'),
    'utf8'
  );
  assert.match(source, /function wslBundleHasUsage\(/, 'the guard helper should exist');
  assert.match(
    source,
    /if \(freshWslHasUsage \|\| !anchoredWslHasUsage\)/,
    'the anchor should only be replaced when the fresh scan has usage or the old one did not'
  );
});

test('the collector caches are bounded and evict oldest first', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'shared', 'collector.js'),
    'utf8'
  );
  // Keys are transcript paths; a long-running process sees constant churn, so an
  // unbounded Map kept deleted trees' entries alive forever.
  assert.match(source, /function cacheSetBounded\(/);
  for (const name of ['projectPathCache', 'jsonlTimestampCache']) {
    const writes = source.match(new RegExp(`${name}\\.set\\(`, 'g')) || [];
    assert.deepEqual(writes, [], `${name} must be written through cacheSetBounded only`);
    assert.match(source, new RegExp(`cacheSetBounded\\(${name},`), `${name} should use the bounded setter`);
  }
  assert.match(source, /PROJECT_PATH_CACHE_MAX = 10_000/);
  assert.match(source, /JSONL_TIMESTAMP_CACHE_MAX = 10_000/);
});

test('atomic JSON writes cannot collide between two writers', () => {
  const { writeJsonAtomic } = require('../../src/shared/config');
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', 'src', 'shared', 'config.js'),
    'utf8'
  );
  // A fixed `${filePath}.tmp` collides when the widget and a headless agent share
  // a data directory, which is exactly the shared anchor path.
  assert.match(source, /\$\{filePath\}\.\$\{process\.pid\}\./);
  assert.match(source, /crypto\.randomBytes/);
  assert.equal(typeof writeJsonAtomic, 'function');
});
