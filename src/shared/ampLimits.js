'use strict';

/**
 * Amp (Sourcegraph Amp) subscription-usage adapter.
 *
 * Amp exposes no documented public usage API. Its own CLI reads a balance
 * summary from an internal JSON-RPC-ish endpoint and renders the result as
 * `display_text`, a single human sentence that mixes the free-tier grant and any
 * purchased credits. That text is the only machine-readable surface there is, so
 * this adapter posts the same request and parses the same sentence — the same
 * approach tokscale takes (crates/tokscale-cli/src/commands/usage/amp.rs).
 *
 * Because the numbers live in prose, the parser is deliberately tolerant: it
 * extracts whatever figures it recognizes and reports the rest as absent rather
 * than guessing. A login without any parseable figure is surfaced as
 * `unavailable` (not `ok` with empty windows) so a changed upstream wording is
 * visible instead of silently showing nothing.
 *
 * Credentials come from Amp's own store, `~/.local/share/amp/secrets.json`,
 * keyed by `apiKey@https://ampcode.com/`. There is no supported way to paste a
 * key into this app, so the provider is read-only from the local file — matching
 * how the CLI itself authenticates.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');

const AMP_FETCH_TIMEOUT_MS = 12_000;
const AMP_API_URL = 'https://ampcode.com/api/internal';
const AMP_SECRETS_KEY = 'apiKey@https://ampcode.com/';
const AMP_WEB_ORIGIN = 'https://ampcode.com';

function ampSecretsPath(options = {}) {
  const home = options.homeDir || os.homedir();
  return path.join(home, '.local', 'share', 'amp', 'secrets.json');
}

function cleanSecret(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

/**
 * Resolve the Amp API key: an explicit option/env override wins, otherwise read
 * Amp's own secrets file. A malformed or unreadable file is treated as absent
 * credentials rather than an error — the user simply has not logged in.
 */
function ampApiKey(options = {}, deps = {}) {
  const explicit = cleanSecret(options.ampApiKey || (deps.env || process.env).AMP_API_KEY);
  if (explicit) return explicit;
  const readFileSync = deps.readFileSync || fs.readFileSync;
  try {
    const parsed = JSON.parse(readFileSync(ampSecretsPath(options), 'utf8'));
    const value = parsed && typeof parsed === 'object' ? parsed[AMP_SECRETS_KEY] : null;
    return cleanSecret(value);
  } catch (_) {
    return '';
  }
}

function hasAmpCredentials(options = {}, deps = {}) {
  return Boolean(ampApiKey(options, deps));
}

// "$4.50" / "$1,200.00" -> 4.5 / 1200. Digits, commas and one dot only, so a
// sentence like "$5 free" cannot be read as a number with trailing junk.
function parseDollarAfter(text, prefix) {
  const start = text.indexOf(prefix);
  if (start < 0) return null;
  const rest = text.slice(start + prefix.length);
  const match = rest.match(/^[0-9][0-9,]*(\.[0-9]+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Parse Amp's `display_text` into windows.
 *
 * Two shapes are recognized, and both may appear at once:
 *   - free tier:  "$4.50/$20.00 remaining" plus an optional "+$0.50/hour"
 *                 replenish rate, which yields a used-percentage meter and an
 *                 estimated reset time (the only reset signal the sentence has);
 *   - credits:    "Individual credits: $12.00 remaining", a count-only balance
 *                 with no denominator, so it ships as a credits window with
 *                 `remaining` and no meter.
 */
function parseAmpDisplayText(text) {
  const windows = [];
  const source = typeof text === 'string' ? text : '';

  const slash = source.indexOf('/$');
  if (slash > 0) {
    const before = source.slice(0, slash);
    const remainingIdx = before.lastIndexOf('$');
    if (remainingIdx >= 0) {
      const remaining = Number(before.slice(remainingIdx + 1).replace(/,/g, ''));
      const after = source.slice(slash + 2);
      const totalMatch = after.match(/^[0-9][0-9,]*(\.[0-9]+)?/);
      const total = totalMatch ? Number(totalMatch[0].replace(/,/g, '')) : NaN;
      if (Number.isFinite(remaining) && Number.isFinite(total) && total > 0) {
        const used = Math.max(0, total - remaining);
        const usedPercent = clampPercent((used / total) * 100);
        const perHour = parseDollarAfter(source, '+$');
        let resetsAt = null;
        if (perHour && perHour > 0 && used > 0) {
          resetsAt = new Date(Date.now() + Math.round((used / perHour) * 3600_000)).toISOString();
        }
        windows.push({
          kind: 'billing',
          metric: 'spend',
          label: 'Free',
          used,
          limit: total,
          remaining,
          usedPercent,
          currency: 'USD',
          showMeter: true,
          ...(resetsAt ? { resetsAt } : {})
        });
      }
    }
  }

  const credits = parseDollarAfter(source, 'Individual credits: $');
  if (credits !== null && credits >= 0) {
    windows.push({
      kind: 'billing',
      metric: 'credits',
      label: 'Credits',
      remaining: credits,
      currency: 'USD',
      // A purchased-credit pool has no denominator, so an empty meter would read
      // as an exhausted grant. Show the money and no bar, like Command Code's
      // top-up window.
      showMeter: false
    });
  }

  return windows;
}

function ampPlanFor(windows) {
  const hasFree = windows.some((window) => window.label === 'Free');
  const hasCredits = windows.some((window) => window.label === 'Credits');
  if (hasFree) return 'Free';
  if (hasCredits) return 'Credits';
  return null;
}

function mapAmpErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function fetchAmpLimits(options = {}, deps = {}) {
  const now = (deps.now || Date.now)();
  const updatedAt = new Date(now).toISOString();
  const key = ampApiKey(options, deps);
  if (!key) {
    return normalizeLimitProvider({
      provider: 'amp',
      source: 'api',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  const requestHeaders = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: AMP_WEB_ORIGIN,
    Referer: `${AMP_WEB_ORIGIN}/`
  };

  try {
    const body = await runWithProbeDeadline(async ({ signal }) => {
      const response = await (deps.fetch || fetch)(AMP_API_URL, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({ method: 'userDisplayBalanceInfo', params: {} }),
        signal
      });
      if (response.status === 401 || response.status === 403) {
        const error = new Error(`Amp returned ${response.status}`);
        error.status = 'unauthorized';
        throw error;
      }
      if (response.status === 429) {
        const error = new Error('Amp returned 429');
        error.status = 'sourceRateLimited';
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`Amp returned ${response.status}`);
        error.status = 'unavailable';
        throw error;
      }
      return response.json();
    }, { deadlineMs: Number(deps.fetchTimeoutMs || AMP_FETCH_TIMEOUT_MS) });

    if (!body || typeof body !== 'object') {
      throw Object.assign(new Error('unexpected balance response shape'), { status: 'unavailable' });
    }
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    if (body.ok === false) {
      // Amp reports application errors in `result.display_text` with HTTP 200.
      // An auth-shaped message must surface as re-auth, not as a transient error.
      const message = String(result.display_text || 'unknown error');
      const looksLikeAuth = /\b(log\s*in|login|cookie|token|auth|key|expired|invalid|unauthor)\b/i.test(message);
      throw Object.assign(new Error(`Amp error: ${message}`), {
        status: looksLikeAuth ? 'unauthorized' : 'unavailable'
      });
    }

    const windows = parseAmpDisplayText(result.display_text);
    const accountKey = hashKey('amp', key);
    return normalizeLimitProvider({
      provider: 'amp',
      accountKey,
      accountLabel: 'Amp',
      source: 'api',
      // No parseable figure means the upstream wording moved: report unavailable
      // rather than an empty-but-successful read.
      status: windows.length ? 'ok' : 'unavailable',
      updatedAt,
      ...(ampPlanFor(windows) ? { planLabel: ampPlanFor(windows) } : {}),
      windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'amp',
      source: 'api',
      status: mapAmpErrorStatus(error),
      updatedAt,
      windows: []
    });
  }
}

module.exports = {
  AMP_API_URL,
  AMP_FETCH_TIMEOUT_MS,
  AMP_SECRETS_KEY,
  AMP_WEB_ORIGIN,
  ampApiKey,
  ampSecretsPath,
  fetchAmpLimits,
  hasAmpCredentials,
  parseAmpDisplayText
};
