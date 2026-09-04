'use strict';

function createFixedWindowRateLimiter(options = {}) {
  const limit = Math.max(1, Math.trunc(Number(options.limit) || 60));
  const windowMs = Math.max(1000, Math.trunc(Number(options.windowMs) || 60_000));
  const maxKeys = Math.max(16, Math.trunc(Number(options.maxKeys) || 4096));
  const entries = new Map();

  function prune(now) {
    if (entries.size < maxKeys) return;
    for (const [key, entry] of entries) {
      if (entry.endsAt <= now || entries.size >= maxKeys) entries.delete(key);
      if (entries.size < maxKeys) break;
    }
  }

  function take(rawKey, now = Date.now()) {
    const key = String(rawKey || 'unknown');
    let entry = entries.get(key);
    if (!entry || entry.endsAt <= now) {
      prune(now);
      entry = { count: 0, endsAt: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    return Object.freeze({
      ok: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfterMs: Math.max(0, entry.endsAt - now)
    });
  }

  return Object.freeze({ take });
}

module.exports = { createFixedWindowRateLimiter };
