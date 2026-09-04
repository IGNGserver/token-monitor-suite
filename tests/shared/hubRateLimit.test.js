'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createFixedWindowRateLimiter } = require('../../src/shared/hubRateLimit');

test('fixed-window Hub rate limiting is keyed and resets after the window', () => {
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.take('a', 0).ok, true);
  assert.equal(limiter.take('a', 1).ok, true);
  assert.equal(limiter.take('a', 2).ok, false);
  assert.equal(limiter.take('b', 2).ok, true);
  assert.equal(limiter.take('a', 1000).ok, true);
});
