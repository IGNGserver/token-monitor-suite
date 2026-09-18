'use strict';

// Performance guard for the session-archive pipeline.
//
// This is the code path that made the widget degrade with use: every collector
// tick re-normalized the whole archive and recomputed an integer allocation per
// archived session, so the per-tick cost grew with the archive until the tick
// could no longer keep up with its own debounce.
//
// Timing assertions are inherently noisy under a loaded CI box, so these measure
// the steady state that actually matters (the archive is already normalized and
// unchanged, which is the case for every tick between archive writes) and take
// the best of several runs. A regression that reintroduces per-session
// normalisation moves the measurement by an order of magnitude, far beyond the
// noise floor.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applySessionUsageArchive,
  captureSessionUsageArchive,
  normalizeSessionUsageArchive
} = require('../../src/shared/sessionUsageArchive');

const NOW = new Date('2026-07-15T00:00:00.000Z');

function buildArchive(sessionCount) {
  const archive = { version: 1, sessions: {} };
  for (let index = 0; index < sessionCount; index += 1) {
    const sessionId = `session-${index}`;
    archive.sessions[`codex:${sessionId}`] = {
      client: 'codex',
      sessionId,
      capturedAt: '2026-07-15T00:00:00.000Z',
      periods: {
        allTime: {
          client: 'codex',
          sessionId,
          totalTokens: index + 1,
          cacheReadTokens: index,
          outputTokens: 2,
          models: { 'gpt-5': index + 1 }
        }
      }
    };
  }
  return archive;
}

function emptySummary() {
  return {
    updatedAt: NOW.toISOString(),
    allTime: { sessions: {} },
    today: { sessions: {} },
    month: { sessions: {} }
  };
}

function bestOf(runs, fn) {
  let best = Infinity;
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now();
    fn();
    best = Math.min(best, performance.now() - startedAt);
  }
  return best;
}

test('a normalized archive is not re-normalized on later passes', () => {
  const raw = buildArchive(200);
  const normalized = normalizeSessionUsageArchive(raw);
  // The marker is what lets load -> capture -> apply share one normalization.
  // Identity equality proves the second pass short-circuits instead of rebuilding.
  assert.equal(normalizeSessionUsageArchive(normalized), normalized);
  assert.equal(normalizeSessionUsageArchive(normalizeSessionUsageArchive(normalized)), normalized);
  // A fresh object (e.g. read back from disk) must still be normalized.
  const reread = JSON.parse(JSON.stringify(raw));
  assert.notEqual(normalizeSessionUsageArchive(reread), reread);
});

test('capturing does not re-normalize the archive it was handed', () => {
  const normalized = normalizeSessionUsageArchive(buildArchive(200));
  const captured = captureSessionUsageArchive(normalized, emptySummary(), NOW);
  assert.equal(captured, normalized, 'capture should mutate/extend the normalized archive in place');
});

test('steady-state apply stays bounded on a large archive', () => {
  const SESSION_COUNT = 2000;
  const archive = normalizeSessionUsageArchive(buildArchive(SESSION_COUNT));
  // Warm the per-session memo so the measurement reflects a long-running process
  // (entries are memoized by object identity and reused between archive writes).
  const summary = emptySummary();
  const first = applySessionUsageArchive(summary, archive, { now: NOW });
  assert.equal(Object.keys(first.allTime.sessions).length, SESSION_COUNT);

  const elapsedMs = bestOf(5, () => {
    applySessionUsageArchive(emptySummary(), archive, { now: NOW });
  });
  assert.ok(
    elapsedMs < 400,
    `steady-state apply of ${SESSION_COUNT} sessions took ${elapsedMs.toFixed(1)}ms`
  );
});

test('applying a large archive scales sub-quadratically', () => {
  // The original defect was per-session normalizePeriod work, which is linear in
  // the archive but with a ~58x constant. Comparing a 4x archive should cost far
  // less than 4x the small-archive time if the memo holds; assert only that it is
  // not quadratic, keeping the bound loose enough for a shared CI machine.
  const small = normalizeSessionUsageArchive(buildArchive(500));
  const large = normalizeSessionUsageArchive(buildArchive(2000));
  applySessionUsageArchive(emptySummary(), small, { now: NOW });
  applySessionUsageArchive(emptySummary(), large, { now: NOW });

  const smallMs = Math.max(1, bestOf(3, () => applySessionUsageArchive(emptySummary(), small, { now: NOW })));
  const largeMs = bestOf(3, () => applySessionUsageArchive(emptySummary(), large, { now: NOW }));
  const ratio = largeMs / smallMs;
  assert.ok(
    ratio < 8,
    `4x the sessions cost ${ratio.toFixed(1)}x the time (small ${smallMs.toFixed(1)}ms, large ${largeMs.toFixed(1)}ms)`
  );
});
